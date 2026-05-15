/**
 * Agent Tick — CBAP Webhook 推送与响应处理
 */

import crypto from 'crypto';
import { GAME_CONFIG } from './config-v2.js';
import { validateActionSchema } from '../../shared/actions-v2.js';

export class AgentTick {
    /**
     * @param {import('./GameLoop.js').GameLoop} gameLoop
     */
    constructor(gameLoop) {
        this.gameLoop = gameLoop;
    }

    /**
     * 向指定 Agent 推送感知并处理响应
     * @param {import('./Character.js').Character} agent
     * @param {Object} perception
     */
    async pushAndProcess(agent, perception) {
        if (!agent.endpoint) return;

        const body = JSON.stringify(perception);
        const signature = this._sign(body);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), GAME_CONFIG.AGENT_TIMEOUT_MS);

            const response = await fetch(agent.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CBAP-Signature': `sha256=${signature}`,
                    'X-CBAP-Tick': String(perception.tick),
                },
                body,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.warn(`[AgentTick] Agent ${agent.id} returned HTTP ${response.status}`);
                return;
            }

            const data = await response.json();
            this._processResponse(agent, data);
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn(`[AgentTick] Agent ${agent.id} timed out (${GAME_CONFIG.AGENT_TIMEOUT_MS}ms)`);
            } else {
                console.warn(`[AgentTick] Agent ${agent.id} unreachable: ${err.message}`);
            }
            // 超时或不可达 → 视为 wait
        }
    }

    /**
     * 处理 Agent 响应
     */
    _processResponse(agent, data) {
        if (!data || typeof data !== 'object') {
            console.warn(`[AgentTick] Agent ${agent.id} returned invalid response`);
            return;
        }

        const actions = Array.isArray(data.actions) ? data.actions : [];
        const reason = typeof data.reason === 'string' ? data.reason : null;

        // 限制动作数
        const limited = actions.slice(0, GAME_CONFIG.MAX_ACTIONS_PER_TICK);

        // Schema 预校验（过滤明显非法的）
        const validSchema = [];
        for (const action of limited) {
            const check = validateActionSchema(action);
            if (check.valid) {
                validSchema.push(action);
            } else {
                console.warn(`[AgentTick] Agent ${agent.id} invalid action: ${check.error}`);
            }
        }

        // 提交到 GameLoop（由 ActionValidator 做完整校验）
        if (validSchema.length > 0 || reason) {
            this.gameLoop.submitActions(agent.id, validSchema, reason);
        }
    }

    /**
     * HMAC-SHA256 签名
     */
    _sign(payload) {
        return crypto
            .createHmac('sha256', GAME_CONFIG.CBAP_SECRET)
            .update(payload)
            .digest('hex');
    }
}
