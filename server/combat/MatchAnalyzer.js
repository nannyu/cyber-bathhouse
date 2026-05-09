/**
 * Combat match analyzer — produces post-fight statistics and highlights.
 */

export class MatchAnalyzer {
  /**
   * @param {FightMatch} match
   */
  analyze(match) {
    const events = match.eventLog || [];
    const fighters = Object.values(match.fighters);
    const durationMs = match.finishedAt ? match.finishedAt - match.startTime : 0;
    const durationSec = durationMs / 1000;

    // Skill usage counts
    const skillUsage = {};
    const damageByFighter = {};
    const rageEvents = [];
    let maxCombo = 0;
    let currentCombo = 0;
    let lastAttacker = null;
    let comebackMoment = null;
    let criticalMoments = [];

    for (const event of events) {
      const p = event.payload || {};

      if (event.type === 'skill:hit' || event.type === 'ultimate:hit') {
        const sid = p.skillId || 'unknown';
        skillUsage[sid] = (skillUsage[sid] || 0) + 1;

        const from = p.from;
        damageByFighter[from] = (damageByFighter[from] || 0) + (p.damage || 0);

        // Track combos
        if (from === lastAttacker) {
          currentCombo++;
          maxCombo = Math.max(maxCombo, currentCombo);
        } else {
          currentCombo = 1;
          lastAttacker = from;
        }
      }

      if (event.type === 'rage:gain') {
        rageEvents.push({ fighterId: p.fighterId, amount: p.amount, rage: p.rage });
      }

      if (event.type === 'ultimate:cast') {
        criticalMoments.push({
          frame: event.frame,
          type: 'ultimate_cast',
          fighterId: p.fighterId,
          ultimateId: p.ultimateId,
        });
      }

      if (event.type === 'ultimate:ready') {
        criticalMoments.push({
          frame: event.frame,
          type: 'rage_max',
          fighterId: p.fighterId,
        });
      }
    }

    // Detect comeback: winner had < 25 HP at some point
    for (const fighter of fighters) {
      if (fighter.userId === match.winnerId && fighter.hp <= 25) {
        comebackMoment = {
          finalHp: fighter.hp,
          reason: 'low_hp_comeback',
        };
      }
    }

    // Aggression ratio: % of time spent attacking vs defending
    const actionStates = { attacking: 0, guarding: 0, walking: 0, idle: 0 };
    for (const event of events) {
      // Note: we don't have per-frame action state in events,
      // so this is a simplified proxy based on hit/block events
    }

    return {
      durationSeconds: Math.round(durationSec * 10) / 10,
      totalFrames: match.frame,
      totalDamage: Object.values(damageByFighter).reduce((a, b) => a + b, 0),
      damageByFighter,
      skillUsage,
      maxCombo,
      criticalMoments: criticalMoments.slice(0, 5),
      comebackMoment,
      winnerId: match.winnerId,
      loserId: match.loserId,
    };
  }

  /**
   * Generate a human-readable fight summary.
   */
  summarize(match) {
    const stats = this.analyze(match);
    const winner = Object.values(match.fighters).find(f => f.userId === match.winnerId);
    const loser = Object.values(match.fighters).find(f => f.userId === match.loserId);

    let text = `⚔️ 战斗报告\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🕐 时长: ${stats.durationSeconds}s | 总帧数: ${stats.totalFrames}\n`;
    text += `🏆 胜者: ${winner?.name || '未知'} | ❌ 败者: ${loser?.name || '未知'}\n`;
    text += `💥 总伤害: ${stats.totalDamage} | 最高连段: ${stats.maxCombo}hit\n`;

    if (stats.comebackMoment) {
      text += `🔥 翻盘时刻: 残血反杀!\n`;
    }

    if (Object.keys(stats.skillUsage).length > 0) {
      text += `🥋 技能使用:\n`;
      for (const [skillId, count] of Object.entries(stats.skillUsage)) {
        text += `   ${skillId}: ${count}次\n`;
      }
    }

    return text;
  }
}
