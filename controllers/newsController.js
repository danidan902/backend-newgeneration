


const News = require('../models/News');
const User = require('../models/User');

// @desc    Create news (Anyone can create now)
// @route   POST /api/news
const createNews = async (req, res) => {
  try {
    const { title, content, targetRoles, sentBy } = req.body;
    
    // Validate targetRoles
    if (!targetRoles || targetRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one target role'
      });
    }
    
    // If sentBy is not provided, use a default user or create one
    let userId = sentBy;
    if (!userId) {
      // Find or create a default super admin
      let defaultAdmin = await User.findOne({ role: 'superadmin' });
      if (!defaultAdmin) {
        defaultAdmin = await User.create({
          name: 'System Admin',
          email: 'admin@system.com',
          password: 'dummy123',
          role: 'superadmin'
        });
      }
      userId = defaultAdmin._id;
    }
    
    const news = await News.create({
      title,
      content,
      targetRoles,
      sentBy: userId
    });
    
    // Populate the sentBy field before sending response
    const populatedNews = await News.findById(news._id).populate('sentBy', 'name email role');
    
    res.status(201).json({
      success: true,
      data: populatedNews
    });
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get news based on role (pass role in query or body)
// @route   GET /api/news
const getNewsByRole = async (req, res) => {
  try {
    // Get role from query parameter or use 'student' as default
    const userRole = req.query.role || 'student';
    
    const news = await News.find({
      targetRoles: { $in: [userRole] },
      isActive: true
    })
    .populate('sentBy', 'name email role')
    .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: news.length,
      data: news
    });
  } catch (error) {
    console.error('Error getting news:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all news (No auth required)
// @route   GET /api/news/all
const getAllNews = async (req, res) => {
  try {
    const news = await News.find()
      .populate('sentBy', 'name email role')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: news.length,
      data: news
    });
  } catch (error) {
    console.error('Error getting all news:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark news as read (No auth required)
// @route   PUT /api/news/:id/read
const markAsRead = async (req, res) => {
  try {
    const { userId } = req.body; // Get userId from request body
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required to mark as read'
      });
    }
    
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }
    
    // Check if user has already read this news
    const alreadyRead = news.readBy.some(
      read => read.user && read.user.toString() === userId
    );
    
    if (!alreadyRead) {
      news.readBy.push({ user: userId, readAt: new Date() });
      await news.save();
    }
    
    const updatedNews = await News.findById(req.params.id).populate('sentBy', 'name email role');
    
    res.status(200).json({
      success: true,
      data: updatedNews
    });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete news (No auth required)
// @route   DELETE /api/news/:id
const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      });
    }
    
    await News.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'News deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createNews,
  getNewsByRole,
  getAllNews,
  markAsRead,
  deleteNews
};