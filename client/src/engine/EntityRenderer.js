/**
 * 实体渲染器 — 角色和设施状态指示
 */

export class EntityRenderer {
    constructor(tileSize) {
        this.tileSize = tileSize;
    }

    /**
     * 渲染所有角色
     */
    renderCharacters(ctx, characters, tick) {
        for (const char of characters) {
            this._renderCharacter(ctx, char, tick);
        }
    }

    _renderCharacter(ctx, char, tick) {
        const size = this.tileSize;
        const px = char.x * size;
        const py = char.y * size;
        const isAgent = char.type === 'agent';

        // 地面阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(px + size / 2, py + size - 4, size * 0.3, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // 角色身体
        ctx.fillStyle = isAgent ? '#7c3aed' : '#2563eb';
        const bodyPad = 6;
        ctx.fillRect(px + bodyPad, py + bodyPad, size - bodyPad * 2, size - bodyPad * 2);

        // 头部
        ctx.fillStyle = isAgent ? '#a78bfa' : '#60a5fa';
        ctx.beginPath();
        ctx.arc(px + size / 2, py + 10, 6, 0, Math.PI * 2);
        ctx.fill();

        // Agent 标记
        if (isAgent) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🤖', px + size / 2, py + size - 2);
        }

        // 名字标签
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        const nameWidth = ctx.measureText(char.name).width;
        ctx.fillRect(px + size / 2 - nameWidth / 2 - 2, py - 12, nameWidth + 4, 12);
        ctx.fillStyle = isAgent ? '#c4b5fd' : '#fff';
        ctx.fillText(char.name, px + size / 2, py - 3);

        // 交互指示器
        if (char.state === 'interacting') {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(px + size / 2, py + size / 2, size * 0.55, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 移动指示（路径剩余）
        if (char.state === 'moving') {
            const bounce = Math.sin(tick * 0.3) * 2;
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(px + size / 2, py - 14 + bounce, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * 渲染设施状态覆盖层（温度条等）
     */
    renderFacilityOverlays(ctx, facilities) {
        for (const f of facilities) {
            if (f.type !== 'boiler') continue;
            this._renderBoilerOverlay(ctx, f);
        }
    }

    _renderBoilerOverlay(ctx, boiler) {
        const size = this.tileSize;
        const px = boiler.x * size;
        const py = boiler.y * size;
        const temp = boiler.state.temperature;

        // 温度条
        const barWidth = size - 8;
        const barHeight = 4;
        const barX = px + 4;
        const barY = py - 8;
        const ratio = Math.min(1, temp / 100);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = ratio > 0.95 ? '#ef4444' : ratio > 0.7 ? '#f59e0b' : '#22c55e';
        ctx.fillRect(barX, barY, barWidth * ratio, barHeight);

        // 温度数字
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(temp)}°`, px + size / 2, barY - 2);
    }
}
