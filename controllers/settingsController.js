const Settings = require('../models/Settings');

// Get settings
exports.getSettings = async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    
    res.status(200).json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update all settings
exports.updateSettings = async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let settings = await Settings.findOne();
    
    if (settings) {
      if (req.body.schoolInfo) settings.schoolInfo = req.body.schoolInfo;
      if (req.body.academicSettings) settings.academicSettings = req.body.academicSettings;
      if (req.body.securitySettings) settings.securitySettings = req.body.securitySettings;
      if (req.body.userManagement) settings.userManagement = req.body.userManagement;
      if (req.body.appearance) settings.appearance = req.body.appearance;
      if (req.body.generalSettings) settings.generalSettings = req.body.generalSettings;
      if (req.body.backupSettings) settings.backupSettings = req.body.backupSettings;
      if (req.body.notificationSettings) settings.notificationSettings = req.body.notificationSettings;
      
      await settings.save();
    } else {
      settings = new Settings(req.body);
      await settings.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Settings saved successfully',
      settings: settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update specific section
exports.updateSettingSection = async (req, res) => {
  try {
    const { section } = req.params;
    const updateData = req.body;
    
    if (req.userRole !== 'admin' && req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    settings[section] = { ...settings[section], ...updateData };
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: `${section} updated successfully`,
      settings: settings
    });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Reset settings
exports.resetSettings = async (req, res) => {
  try {
    if (req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can reset settings' });
    }
    
    await Settings.deleteMany({});
    const defaultSettings = new Settings();
    await defaultSettings.save();
    
    res.status(200).json({
      success: true,
      message: 'Settings reset to default successfully',
      settings: defaultSettings
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get public settings
exports.getPublicSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    res.status(200).json({
      schoolName: settings.schoolInfo?.name || 'School Management System',
      schoolAddress: settings.schoolInfo?.address || '',
      schoolPhone: settings.schoolInfo?.phone || '',
      schoolEmail: settings.schoolInfo?.email || '',
      schoolLogo: settings.schoolInfo?.logo || '',
      primaryColor: settings.appearance?.primaryColor || '#3B82F6',
      theme: settings.appearance?.theme || 'light'
    });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get maintenance status
exports.getMaintenanceStatus = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    
    res.status(200).json({
      maintenanceMode: settings?.maintenanceMode || false,
      maintenanceMessage: settings?.maintenanceMessage || 'System is under maintenance'
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Toggle maintenance mode
exports.toggleMaintenance = async (req, res) => {
  try {
    if (req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can toggle maintenance mode' });
    }
    
    const { enabled, message } = req.body;
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = new Settings();
    }
    
    settings.maintenanceMode = enabled;
    if (message) settings.maintenanceMessage = message;
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      maintenanceMode: settings.maintenanceMode
    });
  } catch (error) {
    console.error('Toggle maintenance error:', error);
    res.status(500).json({ error: error.message });
  }
};