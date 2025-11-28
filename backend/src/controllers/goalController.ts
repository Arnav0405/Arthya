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
    const where: any = { userId: req.user?.id };

    if (status) where.status = status;

    const goals = await Goal.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

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
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
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
      userId: req.user?.id,
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
    const goal = await Goal.findOne({
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    await goal.update(req.body);

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
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    goal.currentAmount += Number(amount);
    
    // Auto-update status if target reached
    if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
      goal.status = 'completed';
    }
    
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
      where: {
        id: req.params.id,
        userId: req.user?.id,
      },
    });

    if (!goal) {
      res.status(404).json({
        success: false,
        message: 'Goal not found',
      });
      return;
    }

    await goal.destroy();

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
