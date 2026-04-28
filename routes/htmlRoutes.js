const express = require('express');
const router = express.Router();
const htmlController = require('../controllers/htmlController');
const path = require('path');

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/admin/login');
};

router.get('/', htmlController.getHomePage);
router.get('/navigator', htmlController.getOcRootPage);

// Admin Authentication
router.get('/admin/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin/dashboard');
    }
    res.sendFile(path.join(__dirname, '../html/admin/login.html'));
});

// Protected Admin Routes
router.get('/admin/settings', isAuthenticated, htmlController.getAdminSettings);
router.get('/admin/dashboard', isAuthenticated, htmlController.getAdminDashboard);
router.get('/admin/campuses', isAuthenticated, htmlController.getManageCampuses);
router.get('/admin/departments', isAuthenticated, htmlController.getManageDepartments);
router.get('/admin/offices', isAuthenticated, htmlController.getManageOffices);
router.get('/admin/programs', isAuthenticated, htmlController.getManagePrograms);
router.get('/admin/events', isAuthenticated, htmlController.getManageEvents);
router.get('/admin/facilities', isAuthenticated, htmlController.getManageFacilities);
router.get('/admin/navigation', isAuthenticated, htmlController.getManageNavigation);
router.get('/admin/personnel/head-officer', isAuthenticated, htmlController.getManageHeadOfficer);
router.get('/admin/personnel/staff', isAuthenticated, htmlController.getManageStaff);

// Client Routes
router.get('/client/main', htmlController.getClientMain);
router.get('/client/department', htmlController.getDepartment);
router.get('/client/departments', htmlController.getListDepartments);
router.get('/client/office', htmlController.getOffice);
router.get('/client/offices', htmlController.getListOffices);

module.exports = router;
