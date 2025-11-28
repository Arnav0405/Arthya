import { Response } from 'express';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { type, startDate, endDate, category, limit = 50, page = 1 } = req.query;

    const query: any = { userId: req.user?._id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
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
      _id: req.params.id,
      userId: req.user?._id,
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
      userId: req.user?._id,
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
    let transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

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
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    await transaction.deleteOne();

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
    const query: any = { userId: req.user?._id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const formattedSummary = {
      income: 0,
      expense: 0,
      transfer: 0,
      incomeCount: 0,
      expenseCount: 0,
      transferCount: 0,
    };

    summary.forEach((item) => {
      if (item._id === 'income') {
        formattedSummary.income = item.total;
        formattedSummary.incomeCount = item.count;
      } else if (item._id === 'expense') {
        formattedSummary.expense = item.total;
        formattedSummary.expenseCount = item.count;
      } else if (item._id === 'transfer') {
        formattedSummary.transfer = item.total;
        formattedSummary.transferCount = item.count;
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
