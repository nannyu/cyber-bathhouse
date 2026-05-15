/**
 * 任务管理器 — 自动生成和追踪任务
 */

import { v4 as uuidv4 } from 'uuid';
import { TASK_STATUS } from '../../shared/actions-v2.js';

export class TaskManager {
    constructor() {
        /** @type {Map<string, Object>} taskId → task */
        this.tasks = new Map();
    }

    /**
     * 检查设施状态并自动生成任务
     * @param {Map<string, import('./Facility.js').Facility>} facilities
     * @param {number} tick
     */
    checkAndGenerate(facilities, tick) {
        for (const facility of facilities.values()) {
            if (facility.type === 'boiler' && facility.isOverheating()) {
                // 检查是否已有该锅炉的修理任务
                const existing = this._findTaskForTarget(facility.id, 'repair');
                if (!existing) {
                    this.createTask({
                        title: '修理锅炉',
                        description: `锅炉 ${facility.id} 温度过高 (${Math.round(facility.state.temperature)}°C)，需要立即修理！`,
                        priority: 'high',
                        location: { x: facility.x, y: facility.y },
                        requiredAction: 'repair',
                        targetId: facility.id,
                        createdAtTick: tick,
                    });
                }
            }
        }
    }

    /**
     * 检查任务完成条件
     * @param {Map<string, import('./Facility.js').Facility>} facilities
     */
    checkCompletion(facilities) {
        for (const task of this.tasks.values()) {
            if (task.status !== TASK_STATUS.PENDING) continue;

            if (task.requiredAction === 'repair' && task.targetId) {
                const facility = facilities.get(task.targetId);
                if (facility && !facility.isOverheating() && facility.state.status === 'normal') {
                    task.status = TASK_STATUS.COMPLETED;
                }
            }
        }
    }

    /**
     * 创建新任务
     * @param {Object} options
     * @returns {Object} 创建的任务
     */
    createTask({ title, description, priority, location, requiredAction, targetId, createdAtTick }) {
        const task = {
            id: `task_${uuidv4().slice(0, 8)}`,
            title,
            description: description || '',
            priority: priority || 'normal',
            location,
            requiredAction,
            targetId,
            status: TASK_STATUS.PENDING,
            createdAtTick: createdAtTick || 0,
        };
        this.tasks.set(task.id, task);
        return task;
    }

    /**
     * 获取所有活跃任务（pending）
     */
    getActiveTasks() {
        return [...this.tasks.values()].filter(t => t.status === TASK_STATUS.PENDING);
    }

    /**
     * 获取所有任务
     */
    getAllTasks() {
        return [...this.tasks.values()];
    }

    /**
     * 查找指定目标的任务
     */
    _findTaskForTarget(targetId, requiredAction) {
        for (const task of this.tasks.values()) {
            if (task.targetId === targetId && task.requiredAction === requiredAction && task.status === TASK_STATUS.PENDING) {
                return task;
            }
        }
        return null;
    }
}
