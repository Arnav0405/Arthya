import { Response } from 'express';
import { Op } from 'sequelize';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';
import sequelize from '../config/database';

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { type, startDate, endDate, category, limit = 50, page = 1 } = req.query;

    const where: any = { userId: req.user?.id };

    if (type) where.type = type;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate as string);
      if (endDate) where.date[Op.lte] = new Date(endDate as string);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where,
      order: [['date', 'DESC']],
      limit: Number(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / Number(limit)),
      data: transactions,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
export const getTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const transaction = await Transaction.findOne({
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const transactionData = {
      ...req.body,
      userId: req.user?.id,
    };

    const transaction = await Transaction.create(transactionData);

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
export const updateTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const transaction = await Transaction.findOne({
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    await transaction.update(req.body);

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
export const deleteTransaction = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const transaction = await Transaction.findOne({
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    await transaction.destroy();

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
// @access  Private
export const getTransactionSummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const where: any = { userId: req.user?.id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate as string);
      if (endDate) where.date[Op.lte] = new Date(endDate as string);
    }

    const summary = await Transaction.findAll({
      where,
      attributes: [
        'type',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['type'],
      raw: true,
    });

    const formattedSummary = {
      income: 0,
      expense: 0,
      transfer: 0,
      incomeCount: 0,
      expenseCount: 0,
      transferCount: 0,
    };

    summary.forEach((item: any) => {
      const total = parseFloat(item.total);
      const count = parseInt(item.count);

      if (item.type === 'income') {
        formattedSummary.income = total;
        formattedSummary.incomeCount = count;
      } else if (item.type === 'expense') {
        formattedSummary.expense = total;
        formattedSummary.expenseCount = count;
      } else if (item.type === 'transfer') {
        formattedSummary.transfer = total;
        formattedSummary.transferCount = count;
      }
    });

    formattedSummary.income = Number(formattedSummary.income.toFixed(2));
    formattedSummary.expense = Number(formattedSummary.expense.toFixed(2));
    formattedSummary.transfer = Number(formattedSummary.transfer.toFixed(2));

    res.status(200).json({
      success: true,
      data: {
        ...formattedSummary,
        savings: Number((formattedSummary.income - formattedSummary.expense).toFixed(2)),
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
