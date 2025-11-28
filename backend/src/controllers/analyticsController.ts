import { Response } from 'express';
import { Op } from 'sequelize';
import Transaction from '../models/Transaction';
import Goal from '../models/Goal';
import Card from '../models/Card';
import { AuthRequest } from '../middleware/auth';
import sequelize from '../config/database';

// @desc    Get financial dashboard
// @route   GET /api/analytics/dashboard
// @access  Private
export const getDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get transaction summary for current month
    const monthlyTransactions = await Transaction.findAll({
      where: {
        userId,
        date: {
          [Op.gte]: startOfMonth,
          [Op.lte]: endOfMonth,
        },
      },
      attributes: [
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['type'],
      raw: true,
    });

    const summary = {
      income: 0,
      expense: 0,
      savings: 0,
    };

    monthlyTransactions.forEach((item: any) => {
      const total = parseFloat(item.total);
      if (item.type === 'income') summary.income = total;
      if (item.type === 'expense') summary.expense = total;
    });

    summary.savings = summary.income - summary.expense;

    // Get active goals
    const activeGoals = await Goal.findAll({
      where: {
        userId,
        status: 'active',
      },
      limit: 5,
    });

    // Get total available balance from cards
    const cards = await Card.findAll({
      where: { userId, isActive: true },
    });

    const totalBalance = cards.reduce((sum, card) => sum + Number(card.balance), 0);
    const totalCreditLimit = cards.reduce(
      (sum, card) => sum + (card.creditLimit ? Number(card.creditLimit) : 0),
      0
    );

    // Get recent transactions
    const recentTransactions = await Transaction.findAll({
      where: { userId },
      order: [['date', 'DESC']],
      limit: 10,
    });

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
    const userId = req.user?.id;
    const { period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));

    const trends = await Transaction.findAll({
      where: {
        userId,
        date: { [Op.gte]: daysAgo },
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('date')), 'date'],
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
      ],
      group: [sequelize.fn('DATE', sequelize.col('date')), 'type'],
      order: [[sequelize.fn('DATE', sequelize.col('date')), 'ASC']],
      raw: true,
    });

    // Get spending by category
    const categoryBreakdown = await Transaction.findAll({
      where: {
        userId,
        type: 'expense',
        date: { [Op.gte]: daysAgo },
      },
      attributes: [
        'category',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
      raw: true,
    });

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
    const userId = req.user?.id;

    // Get last 6 months income
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyIncome = await Transaction.findAll({
      where: {
        userId,
        type: 'income',
        date: { [Op.gte]: sixMonthsAgo },
      },
      attributes: [
        [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM date')), 'year'],
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM date')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('amount')), 'avgAmount'],
      ],
      group: [
        sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM date')),
        sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM date')),
      ],
      order: [
        [sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM date')), 'ASC'],
        [sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM date')), 'ASC'],
      ],
      raw: true,
    });

    // Get income by category
    const incomeByCategory = await Transaction.findAll({
      where: {
        userId,
        type: 'income',
        date: { [Op.gte]: sixMonthsAgo },
      },
      attributes: [
        'category',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['category'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']],
      raw: true,
    });

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
