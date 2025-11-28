import { Response } from 'express';
import Goal from '../models/Goal';
import { AuthRequest } from '../middleware/auth';

// @desc    Get all goals for user
// @route   GET /api/goals
// @access  Private
export const getGoals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status } = req.query;
    const query: any = { userId: req.user?._id };

    if (status) query.status = status;

    const goals = await Goal.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: goals.length,
      data: goals,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single goal
// @route   GET /api/goals/:id
// @access  Private
export const getGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: goal,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create goal
// @route   POST /api/goals
// @access  Private
export const createGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const goalData = {
      ...req.body,
      userId: req.user?._id,
    };

    const goal = await Goal.create(goalData);

    res.status(201).json({
      success: true,
      data: goal,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update goal
// @route   PUT /api/goals/:id
// @access  Private
export const updateGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    let goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    goal = await Goal.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: goal,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update goal progress
// @route   PUT /api/goals/:id/progress
// @access  Private
export const updateGoalProgress = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid amount',
      });
      return;
    }

    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    goal.currentAmount += Number(amount);
    await goal.save();

    res.status(200).json({
      success: true,
      data: goal,
      message: goal.status === 'completed' ? 'Congratulations! Goal achieved!' : 'Progress updated',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete goal
// @route   DELETE /api/goals/:id
// @access  Private
export const deleteGoal = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const goal = await Goal.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    await goal.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
