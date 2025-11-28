import { Response } from 'express';
import Transaction from '../models/Transaction';
import Goal from '../models/Goal';
import Card from '../models/Card';
import { AuthRequest } from '../middleware/auth';

// @desc    Get financial dashboard
// @route   GET /api/analytics/dashboard
// @access  Private
export const getDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get transaction summary for current month
    const monthlyTransactions = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      income: 0,
      expense: 0,
      savings: 0,
    };

    monthlyTransactions.forEach((item: any) => {
      if (item._id === 'income') summary.income = item.total;
      if (item._id === 'expense') summary.expense = item.total;
    });

    summary.savings = summary.income - summary.expense;

    // Get active goals
    const activeGoals = await Goal.find({
      userId,
      status: 'active',
    }).limit(5);

    // Get total available balance from cards
    const cards = await Card.find({ userId, isActive: true });
    const totalBalance = cards.reduce((sum, card) => sum + card.balance, 0);
    const totalCreditLimit = cards.reduce(
      (sum, card) => sum + (card.creditLimit || 0),
      0
    );

    // Get recent transactions
    const recentTransactions = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          income: Number(summary.income.toFixed(2)),
          expense: Number(summary.expense.toFixed(2)),
          savings: Number(summary.savings.toFixed(2)),
          availableBalance: Number(totalBalance.toFixed(2)),
          creditLimit: Number(totalCreditLimit.toFixed(2)),
        },
        activeGoals,
        recentTransactions,
        cards,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get spending trends
// @route   GET /api/analytics/trends
// @access  Private
export const getSpendingTrends = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));

    const trends = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.date': 1 },
      },
    ]);

    // Get spending by category
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        trends,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get income analysis
// @route   GET /api/analytics/income
// @access  Private
export const getIncomeAnalysis = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Get last 6 months income
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyIncome = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'income',
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    // Get income by category
    const incomeByCategory = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'income',
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        monthlyIncome,
        incomeByCategory,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
