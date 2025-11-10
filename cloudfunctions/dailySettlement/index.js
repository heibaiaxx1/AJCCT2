const cloudbase = require('@cloudbase/node-sdk');

// 初始化 CloudBase
const app = cloudbase.init({
  env: 'cloud1-4g8gnb2uda2a2c54'
});

const db = app.database();

// 连击护盾计算逻辑
function calculateStreakAndShields(currentStreak, currentShields, isTodayValid, currentWeekEffDays) {
  let newStreak = currentStreak;
  let newShields = currentShields;
  let newWeekEffDays = currentWeekEffDays;
  
  if (isTodayValid) {
    // 今日有效
    newStreak += 1;
    newWeekEffDays += 1;
  } else {
    // 今日无效
    if (newStreak > 0) {
      if (newShields > 0) {
        // 使用护盾保护
        newShields -= 1;
        newStreak -= 1; // 护盾只回退1层
      } else {
        // 没有护盾，连击重置
        newStreak = 0;
      }
    }
  }
  
  // 每周护盾奖励
  if (newWeekEffDays >= 5) {
    if (newShields < 2) {
      newShields = 2; // 上限2枚
    }
  }
  
  return { newStreak, newShields, newWeekEffDays };
}

// 获取周开始日期
function getWeekStart(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一为周开始
  const weekStart = new Date(date.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

exports.main = async (event, context) => {
  try {
    const { userId, date, effMin, longestEffMin, focusRate, sessions = [] } = event;
    
    if (!userId || !date) {
      return { success: false, error: '缺少必要参数: userId 和 date' };
    }
    
    // 判断今日是否有效
    const isTodayValid = effMin >= 10;
    
    // 获取当前用户的连击状态
    const streakStateRes = await db.collection('streakState')
      .where({
        userId: userId
      })
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    
    let currentStreakState = streakStateRes.data[0];
    const weekStart = getWeekStart(date);
    
    // 判断是否跨周
    let currentWeekEffDays = 0;
    if (currentStreakState && currentStreakState.weekStart === weekStart) {
      currentWeekEffDays = currentStreakState.weeklyEffDays || 0;
    }
    
    // 计算新的连击和护盾状态
    const { newStreak, newShields, newWeekEffDays } = calculateStreakAndShields(
      currentStreakState ? currentStreakState.streak : 0,
      currentStreakState ? currentStreakState.shields : 0,
      isTodayValid,
      currentWeekEffDays
    );
    
    // 更新或创建 dailyStats
    const dailyStatsId = `${date}_${userId}`;
    const dailyStatsData = {
      userId,
      date,
      effMin: effMin || 0,
      longestEffMin: longestEffMin || 0,
      focusRate: focusRate || 0,
      validDay: isTodayValid,
      sessions,
      streak: newStreak,
      shields: newShields,
      weeklyEffDays: newWeekEffDays,
      weekStart,
      updatedAt: new Date()
    };
    
    await db.collection('dailyStats').doc(dailyStatsId).set(dailyStatsData);
    
    // 更新或创建 streakState
    const streakStateId = `${date}_${userId}`;
    const streakStateData = {
      userId,
      date,
      streak: newStreak,
      shields: newShields,
      weeklyEffDays: newWeekEffDays,
      weekStart,
      updatedAt: new Date()
    };
    
    await db.collection('streakState').doc(streakStateId).set(streakStateData);
    
    return {
      success: true,
      data: {
        dailyStats: dailyStatsData,
        streakState: streakStateData
      }
    };
    
  } catch (error) {
    console.error('每日结算云函数执行失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};