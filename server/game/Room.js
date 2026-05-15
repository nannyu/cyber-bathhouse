/**
 * 房间 — 游戏世界状态容器
 */

import { v4 as uuidv4 } from 'uuid';
import { TileMap } from './TileMap.js';
import { Character } from './Character.js';
import { Facility } from './Facility.js';
import { TaskManager } from './TaskManager.js';
import { GAME_CONFIG } from './config-v2.js';

export class Room {
    /**
     * @param {Object} mapData - 地图 JSON 数据
     */
    constructor(mapData) {
        this.id = `room_${uuidv4().slice(0, 8)}`;
        this.map = new TileMap(mapData);
        this.tick = 0;

        /** @type {Map<string, Character>} */
        this.characters = new Map();

        /** @type {Map<string, Facility>} */
        this.facilities = new Map();

        /** @type {TaskManager} */
        this.taskManager = new TaskManager();

        // 初始化设施
        for (const f of mapData.facilities || []) {
            this.facilities.set(f.id, new Facility(f));
        }
    }

    /**
     * 添加角色
     */
    addCharacter(options) {
        const spawn = options.type === 'agent'
            ? this.map.spawns.agent
            : this.map.spawns.player;
        const char = new Character({
            ...options,
            x: options.x ?? spawn?.x ?? 1,
            y: options.y ?? spawn?.y ?? 1,
        });
        this.characters.set(char.id, char);
        return char;
    }

    /**
     * 移除角色
     */
    removeCharacter(id) {
        return this.characters.delete(id);
    }

    /**
     * 获取角色
     */
    getCharacter(id) {
        return this.characters.get(id) || null;
    }

    /**
     * 获取设施
     */
    getFacility(id) {
        return this.facilities.get(id) || null;
    }

    /**
     * 推进所有角色移动
     */
    advanceMovement() {
        for (const char of this.characters.values()) {
            char.advance();
        }
    }

    /**
     * 更新所有设施状态
     */
    updateFacilities() {
        for (const facility of this.facilities.values()) {
            facility.tick();
        }
    }

    /**
     * 能量自然恢复
     */
    regenAllEnergy() {
        for (const char of this.characters.values()) {
            char.regenEnergy();
        }
    }

    /**
     * 检查并生成任务
     */
    checkTasks() {
        this.taskManager.checkAndGenerate(this.facilities, this.tick);
        this.taskManager.checkCompletion(this.facilities);
    }

    /**
     * 获取指定角色的感知数据（用于 Agent Tick）
     */
    getPerception(characterId) {
        const char = this.characters.get(characterId);
        if (!char) return null;

        const range = GAME_CONFIG.VISIBILITY_RANGE;
        const visibleEntities = [];

        // 可见角色
        for (const other of this.characters.values()) {
            if (other.id === characterId) continue;
            if (Math.abs(other.x - char.x) <= range && Math.abs(other.y - char.y) <= range) {
                visibleEntities.push({
                    id: other.id,
                    type: other.type,
                    x: other.x,
                    y: other.y,
                    state: other.state,
                    name: other.name,
                });
            }
        }

        // 可见设施
        for (const facility of this.facilities.values()) {
            if (Math.abs(facility.x - char.x) <= range && Math.abs(facility.y - char.y) <= range) {
                visibleEntities.push({
                    id: facility.id,
                    type: 'facility',
                    facilityType: facility.type,
                    x: facility.x,
                    y: facility.y,
                    state: facility.state,
                });
            }
        }

        return {
            agent_id: characterId,
            tick: this.tick,
            location: { x: char.x, y: char.y },
            energy: Math.round(char.energy),
            visible_entities: visibleEntities,
            active_tasks: this.taskManager.getActiveTasks(),
            available_actions: ['move_to', 'interact', 'wait', 'say'],
        };
    }

    /**
     * 获取完整房间状态（用于广播）
     */
    getState() {
        return {
            roomId: this.id,
            tick: this.tick,
            characters: [...this.characters.values()].map(c => c.toJSON()),
            facilities: [...this.facilities.values()].map(f => f.toJSON()),
            tasks: this.taskManager.getActiveTasks(),
        };
    }
}
