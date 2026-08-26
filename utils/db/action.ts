'use server';

import { db } from './dbConfig';
import { Users, Reports, Rewards, CollectedWastes, Notifications, Transactions } from './schema';
import { eq, sql, and, desc } from 'drizzle-orm';

/**
 * USERS
 */
export async function createUser(email?: string, name?: string) {
  try {
    const [user] = await db.insert(Users)
      .values({ email: email ?? null, name: name ?? null })
      .returning()
      .execute();
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    return null;
  }
}

export async function getUserByEmail(email?: string) {
  if (!email) return null;
  try {
    const [user] = await db.select().from(Users).where(eq(Users.email, email)).execute();
    return user;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

export async function getUserById(userId?: number) {
  if (!userId) return null;
  try {
    const [user] = await db.select().from(Users).where(eq(Users.id, userId)).execute();
    return user;
  } catch (error) {
    console.error("Error fetching user by id:", error);
    return null;
  }
}

export async function getHeaderData(email?: string) {
  const user = await getUserByEmail(email);
  if (!user?.id) return null;

  const [notifications, transactions] = await Promise.all([
    getUnreadNotifications(user.id),
    getRewardTransactions(user.id),
  ]);
  const balance = transactions.reduce((total, transaction) => (
    transaction.type.startsWith('earned')
      ? total + transaction.amount
      : total - transaction.amount
  ), 0);

  return {
    user,
    notifications,
    balance: Math.max(balance, 0),
  };
}

/**
 * REPORTS
 */
export async function createReport(
  userId?: number | null,
  location?: string,
  wasteType?: string,
  amount?: string,
  imageUrl?: string,
  type?: string,
  verificationResult?: any
) {
  try {
    const [report] = await db.insert(Reports)
      .values({
        userId: userId ?? null,
        location: location ?? null,
        wasteType: wasteType ?? null,
        amount: amount ?? null,
        imageUrl: imageUrl ?? null,
        verificationResult: verificationResult ?? null,
        status: "pending",
      })
      .returning()
      .execute();

    if (userId) {
      const pointsEarned = 10;
      await updateRewardPoints(userId, pointsEarned);
      await createTransaction(userId, 'earned_report', pointsEarned, 'Points earned for reporting waste');
      await createNotification(userId, `You've earned ${pointsEarned} points for reporting waste!`, 'reward');
    }

    return report;
  } catch (error) {
    console.error("Error creating report:", error);
    return null;
  }
}

export async function getReportsByUserId(userId?: number) {
  if (!userId) return [];
  try {
    return await db.select().from(Reports).where(eq(Reports.userId, userId)).execute();
  } catch (error) {
    console.error("Error fetching reports:", error);
    return [];
  }
}

/**
 * REWARDS
 */
export async function getOrCreateReward(userId?: number) {
  if (!userId) return null;
  try {
    let [reward] = await db.select().from(Rewards).where(eq(Rewards.userId, userId)).execute();
    if (!reward) {
      [reward] = await db.insert(Rewards)
        .values({
          userId,
          name: 'Default Reward',
          collectionInfo: 'Default Collection Info',
          points: 0,
          level: 1,
          isAvailable: true,
        })
        .returning()
        .execute();
    }
    return reward;
  } catch (error) {
    console.error("Error getting or creating reward:", error);
    return null;
  }
}

export async function updateRewardPoints(userId?: number, pointsToAdd?: number) {
  if (!userId || pointsToAdd === undefined) return null;
  try {
    const [updatedReward] = await db.update(Rewards)
      .set({
        points: sql`${Rewards.points} + ${pointsToAdd}`,
        updatedAt: new Date()
      })
      .where(eq(Rewards.userId, userId))
      .returning()
      .execute();
    return updatedReward;
  } catch (error) {
    console.error("Error updating reward points:", error);
    return null;
  }
}

/**
 * TRANSACTIONS
 */
export async function createTransaction(
  userId?: number,
  type?: 'earned_report' | 'earned_collect' | 'redeemed',
  amount?: number,
  description?: string
) {
  if (!userId) return null;
  try {
    const [transaction] = await db.insert(Transactions)
      .values({
        userId: userId ?? null,
        type: type ?? null,
        amount: amount ?? null,
        description: description ?? null
      })
      .returning()
      .execute();
    return transaction;
  } catch (error) {
    console.error("Error creating transaction:", error);
    return null;
  }
}

/**
 * COLLECTED WASTES
 */
export async function createCollectedWaste(reportId?: number, collectorId?: number, notes?: string) {
  try {
    const [collectedWaste] = await db.insert(CollectedWastes)
      .values({
        reportId: reportId ?? null,
        collectorId: collectorId ?? null,
        collectionDate: new Date(),
        status: notes ? 'verified' : 'collected',
      })
      .returning()
      .execute();
    return collectedWaste;
  } catch (error) {
    console.error("Error creating collected waste:", error);
    return null;
  }
}

export async function getCollectedWastesByCollector(collectorId?: number) {
  if (!collectorId) return [];
  try {
    return await db.select().from(CollectedWastes).where(eq(CollectedWastes.collectorId, collectorId)).execute();
  } catch (error) {
    console.error("Error fetching collected wastes:", error);
    return [];
  }
}

/**
 * NOTIFICATIONS
 */
export async function createNotification(userId?: number, message?: string, type?: string) {
  if (!userId) return null;
  try {
    const [notification] = await db.insert(Notifications)
      .values({
        userId: userId ?? null,
        message: message ?? null,
        type: type ?? null
      })
      .returning()
      .execute();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function getUnreadNotifications(userId?: number) {
  if (!userId) return [];
  try {
    return await db.select().from(Notifications).where(
      and(
        eq(Notifications.userId, userId),
        eq(Notifications.isRead, false)
      )
    ).execute();
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId?: number) {
  if (!notificationId) return;
  try {
    await db.update(Notifications).set({ isRead: true }).where(eq(Notifications.id, notificationId)).execute();
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

/**
 * TASKS & REPORTS
 */
export async function updateReportStatus(reportId?: number, status?: string, collectorId?: number | null) {
  if (!reportId || !status) return null;
  try {
    const [updatedReport] = await db.update(Reports)
      .set({ status: status ?? null, collectorId: collectorId ?? null })
      .where(eq(Reports.id, reportId))
      .returning()
      .execute();
    return updatedReport;
  } catch (error) {
    console.error("Error updating report status:", error);
    return null;
  }
}

export async function getPendingReports(limit?: number) {
  try {
    const query = db.select().from(Reports).where(eq(Reports.status, "pending"));
    return limit === undefined ? await query.execute() : await query.limit(limit).execute();
  } catch (error) {
    console.error("Error fetching pending reports:", error);
    return [];
  }
}

export async function getRecentReports(limit: number = 10) {
  try {
    return await db.select().from(Reports).orderBy(desc(Reports.createdAt)).limit(limit).execute();
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    return [];
  }
}

export async function getLeaderboardRewards(limit: number = 100) {
  try {
    const rewards = await db
      .select({
        id: Rewards.id,
        userId: Rewards.userId,
        points: Rewards.points,
        level: Rewards.level,
        createdAt: Rewards.createdAt,
        userName: Users.name,
      })
      .from(Rewards)
      .leftJoin(Users, eq(Rewards.userId, Users.id))
      .orderBy(desc(Rewards.points))
      .limit(limit)
      .execute();

    return rewards.map((reward) => ({
      ...reward,
      userId: reward.userId ?? 0,
      points: reward.points ?? 0,
      level: reward.level ?? 1,
      userName: reward.userName ?? 'Anonymous User',
    }));
  } catch (error) {
    console.error("Error fetching leaderboard rewards:", error);
    return [];
  }
}

/**
 * REWARDS & REDEMPTION
 */
export async function saveReward(userId?: number, amount?: number) {
  if (!userId || amount === undefined) return null;
  try {
    const [reward] = await db.insert(Rewards)
      .values({
        userId: userId ?? null,
        name: 'Waste Collection Reward',
        collectionInfo: 'Points earned from waste collection',
        points: amount ?? 0,
        level: 1,
        isAvailable: true,
      })
      .returning()
      .execute();

    if (userId) {
      await createTransaction(userId, 'earned_collect', amount ?? 0, 'Points earned for collecting waste');
    }

    return reward;
  } catch (error) {
    console.error("Error saving reward:", error);
    return null;
  }
}

export async function redeemReward(userId?: number, rewardId?: number) {
  if (!userId || rewardId === undefined) return null;
  try {
    const userReward: any = await getOrCreateReward(userId);

    if (!userReward) return null;

    if (rewardId === 0) {
      const [updatedReward] = await db.update(Rewards)
        .set({
          points: 0,
          updatedAt: new Date(),
        })
        .where(eq(Rewards.userId, userId))
        .returning()
        .execute();

      await createTransaction(userId, 'redeemed', userReward.points ?? 0, `Redeemed all points: ${userReward.points ?? 0}`);
      return updatedReward;
    } else {
      const [availableReward] = await db.select().from(Rewards).where(eq(Rewards.id, rewardId)).execute();
      if (!availableReward) return null;

      const redeemPoints = availableReward.points ?? 0;
      if ((userReward.points ?? 0) < redeemPoints) {
        throw new Error("Insufficient points or invalid reward");
      }

      const [updatedReward] = await db.update(Rewards)
        .set({
          points: sql`${Rewards.points} - ${redeemPoints}`,
          updatedAt: new Date(),
        })
        .where(eq(Rewards.userId, userId))
        .returning()
        .execute();

      await createTransaction(userId, 'redeemed', redeemPoints, `Redeemed: ${availableReward.name ?? 'Unknown Reward'}`);
      return updatedReward;
    }
  } catch (error) {
    console.error("Error redeeming reward:", error);
    return null;
  }
}

/**
 * GET TRANSACTIONS & BALANCE
 */
export async function getRewardTransactions(userId?: number) {
  if (!userId) return [];
  try {
    const transactions = await db
      .select({
        id: Transactions.id,
        type: Transactions.type,
        amount: Transactions.amount,
        description: Transactions.description,
        date: Transactions.date,
      })
      .from(Transactions)
      .where(eq(Transactions.userId, userId))
      .orderBy(desc(Transactions.date))
      .limit(10)
      .execute();

    return transactions.map(t => ({
      ...t,
      amount: t.amount ?? 0,
      type: t.type ?? 'unknown',
      description: t.description ?? '',
      date: t.date ? t.date.toISOString().split('T')[0] : null,
    }));
  } catch (error) {
    console.error("Error fetching reward transactions:", error);
    return [];
  }
}

export async function getUserBalance(userId?: number): Promise<number> {
  if (!userId) return 0;
  const transactions = await getRewardTransactions(userId);
  const balance = transactions.reduce((acc, transaction) => {
    if (!transaction.amount) return acc;
    return transaction.type.startsWith('earned') ? acc + transaction.amount : acc - transaction.amount;
  }, 0);
  return Math.max(balance, 0);
}

/**
 * AVAILABLE REWARDS
 */
export async function getAvailableRewards(userId?: number, userPoints?: number) {
  if (!userId) return [];

  try {
    const points = userPoints ?? await getUserBalance(userId);

    const dbRewards = await db
      .select({
        id: Rewards.id,
        name: Rewards.name,
        cost: Rewards.points,
        description: Rewards.description,
        collectionInfo: Rewards.collectionInfo,
      })
      .from(Rewards)
      .where(eq(Rewards.isAvailable, true))
      .execute();

    const allRewards = [
      {
        id: 0,
        name: "Your Points",
        cost: points,
        description: "Redeem your earned points",
        collectionInfo: "Points earned from reporting and collecting waste"
      },
      ...dbRewards.map(r => ({
        id: r.id ?? 0,
        name: r.name ?? 'Unknown',
        cost: r.cost ?? 0,
        description: r.description ?? '',
        collectionInfo: r.collectionInfo ?? ''
      }))
    ];

    return allRewards;
  } catch (error) {
    console.error("Error fetching available rewards:", error);
    return [];
  }
}

/**
 * ALIASES / WRAPPERS for frontend compatibility
 */
export async function getWasteCollectionTasks(limit?: number) {
  return getPendingReports(limit);
}

export async function updateTaskStatus(reportId?: number, status?: string, collectorId?: number | null) {
  return updateReportStatus(reportId, status, collectorId);
}

export async function saveCollectedWaste(reportId?: number, collectorId?: number, notes?: string) {
  return createCollectedWaste(reportId, collectorId, notes);
}

export async function getAllRewards(userId?: number) {
  return getAvailableRewards(userId);
}
