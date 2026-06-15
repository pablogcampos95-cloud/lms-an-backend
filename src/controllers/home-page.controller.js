const homePageService = require('../services/home-page.service');

const getPublic = async (req, res) => {
  res.json({ ok: true, data: await homePageService.getPublicConfig() });
};

const getAdmin = async (req, res) => {
  res.json({ ok: true, data: await homePageService.getAdminConfig() });
};

const saveAdmin = async (req, res) => {
  res.json({ ok: true, data: await homePageService.saveAdminConfig(req.body.config || req.body, req.user.id, Boolean(req.body.publish)) });
};

const restoreDefaults = async (req, res) => {
  res.json({ ok: true, data: await homePageService.restoreDefaults(req.user.id, Boolean(req.body.publish)) });
};

module.exports = {
  getPublic,
  getAdmin,
  saveAdmin,
  restoreDefaults,
};
