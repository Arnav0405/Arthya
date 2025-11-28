import { Response } from 'express';
import { Op } from 'sequelize';
import Transaction from '../models/Transaction';
import Goal from '../models/Goal';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

// @desc    Get AI financial coaching advice
// @route   POST /api/coaching/advice
// @access  Private
export const getFinancialAdvice = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Get recent financial data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await Transaction.findAll({
      where: {
        userId,
        date: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const income = recentTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = recentTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Get active goals
    const activeGoals = await Goal.findAll({
      where: { userId, status: 'active' },
    });

    // Generate personalized advice
    const advice = [];

    // Savings rate advice
    if (savingsRate < 10) {
      advice.push({
        type: 'warning',
        category: 'savings',
        title: 'Low Savings Rate',
        message: `Your savings rate is ${savingsRate.toFixed(1)}%. Try to save at least 20% of your income for a healthier financial future.`,
        actionable: 'Set up automatic transfers to savings after each paycheck.',
      });
    } else if (savingsRate >= 20) {
      advice.push({
        type: 'success',
        category: 'savings',
        title: 'Excellent Savings!',
        message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep up the great work!`,
        actionable: 'Consider investing some of your savings for long-term growth.',
      });
    }

    // Expense analysis
    const expensesByCategory = recentTransactions
      .filter((t) => t.type === 'expense')
      .reduce((acc: any, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {});

    const topExpenseCategory = Object.entries(expensesByCategory).sort(
      (a: any, b: any) => b[1] - a[1]
    )[0];

    if (topExpenseCategory) {
      const percentage = ((topExpenseCategory[1] as number) / expenses) * 100;
      if (percentage > 30) {
        advice.push({
          type: 'info',
          category: 'spending',
          title: 'High Spending in One Category',
          message: `${percentage.toFixed(1)}% of your expenses are in ${topExpenseCategory[0]}. Consider reviewing these expenses.`,
          actionable: `Look for ways to reduce ${topExpenseCategory[0]} costs.`,
        });
      }
    }

    // Goal progress advice
    activeGoals.forEach((goal) => {
      const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
      if (progress < 50 && goal.deadline) {
        const daysLeft = Math.ceil(
          (goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft < 90) {
          const monthlyNeeded =
            (Number(goal.targetAmount) - Number(goal.currentAmount)) / (daysLeft / 30);
          advice.push({
            type: 'alert',
            category: 'goals',
            title: `Goal Deadline Approaching: ${goal.title}`,
            message: `You need to save approximately $${monthlyNeeded.toFixed(2)} per month to reach this goal on time.`,
            actionable: 'Adjust your budget to allocate more towards this goal.',
          });
        }
      }
    });

    // Income variability advice (for gig workers)
    const incomeTransactions = recentTransactions.filter(
      (t) => t.type === 'income'
    );
    if (incomeTransactions.length > 0) {
      const avgIncome = income / incomeTransactions.length;
      const variance = incomeTransactions.reduce(
        (sum, t) => sum + Math.pow(Number(t.amount) - avgIncome, 2),
        0
      );
      const stdDev = Math.sqrt(variance / incomeTransactions.length);
      const coefficientOfVariation = (stdDev / avgIncome) * 100;

      if (coefficientOfVariation > 30) {
        advice.push({
          type: 'info',
          category: 'income',
          title: 'Variable Income Detected',
          message: 'Your income varies significantly. Build an emergency fund covering 3-6 months of expenses.',
          actionable: 'Save extra during high-income months to cover low-income periods.',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        advice,
        summary: {
          income: Number(income.toFixed(2)),
          expenses: Number(expenses.toFixed(2)),
          savingsRate: Number(savingsRate.toFixed(1)),
          activeGoals: activeGoals.length,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get spending insights
// @route   GET /api/coaching/insights
// @access  Private
export const getSpendingInsights = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));

    const transactions = await Transaction.findAll({
      where: {
        userId,
        type: 'expense',
        date: { [Op.gte]: daysAgo },
      },
    });

    const insights = {
      totalSpent: 0,
      averageTransaction: 0,
      mostExpensiveDay: '',
      mostExpensiveCategory: '',
      unusualSpending: [],
    };

    if (transactions.length > 0) {
      insights.totalSpent = transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
      insights.averageTransaction = insights.totalSpent / transactions.length;

      // Group by day
      const spendingByDay: any = {};
      transactions.forEach((t) => {
        const day = t.date.toISOString().split('T')[0];
        spendingByDay[day] = (spendingByDay[day] || 0) + Number(t.amount);
      });

      insights.mostExpensiveDay = Object.entries(spendingByDay).sort(
        (a: any, b: any) => b[1] - a[1]
      )[0]?.[0] || '';

      // Group by category
      const spendingByCategory: any = {};
      transactions.forEach((t) => {
        spendingByCategory[t.category] =
          (spendingByCategory[t.category] || 0) + Number(t.amount);
      });

      insights.mostExpensiveCategory = Object.entries(spendingByCategory).sort(
        (a: any, b: any) => b[1] - a[1]
      )[0]?.[0] || '';
    }

    res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create smart notification
// @route   POST /api/coaching/notify
// @access  Private
export const createSmartNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { title, message, type, category } = req.body;

    const notification = await Notification.create({
      userId: req.user?.id,
      title,
      message,
      type,
      category,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
