const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const { upload } = require('../config/cloudinary');

// Authentication Middleware
const isAdmin = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
};

// Authentication
router.post('/login', apiController.login);
router.post('/logout', apiController.logout);
router.get('/check-auth', apiController.checkAuth);

// Dashboard
router.get('/dashboard/stats', isAdmin, apiController.getDashboardStats);

// Departments
router.get('/departments', apiController.getDepartments);
router.post('/departments', isAdmin, upload.array('images', 5), apiController.createDepartment);
router.put('/departments/:id', isAdmin, upload.array('images', 5), apiController.updateDepartment);
router.delete('/departments/:id', isAdmin, apiController.deleteDepartment);
router.delete('/photos/:id', isAdmin, apiController.deletePhoto);

// Campuses
router.get('/campuses', apiController.getCampuses);
router.post('/campuses', isAdmin, apiController.createCampus);
router.put('/campuses/:id', isAdmin, apiController.updateCampus);
router.delete('/campuses/:id', isAdmin, apiController.deleteCampus);

// Offices
router.get('/offices', apiController.getOffices);
router.post('/offices', isAdmin, upload.array('images', 5), apiController.createOffice);
router.put('/offices/:id', isAdmin, upload.array('images', 5), apiController.updateOffice);
router.delete('/offices/:id', isAdmin, apiController.deleteOffice);
router.delete('/office-photos/:id', isAdmin, apiController.deleteOfficePhoto);

// Head Officers
router.get('/head-officers', apiController.getHeadOfficers);
router.post('/head-officers', isAdmin, upload.single('image'), apiController.createHeadOfficer);
router.put('/head-officers/:id', isAdmin, upload.single('image'), apiController.updateHeadOfficer);
router.delete('/head-officers/:id', isAdmin, apiController.deleteHeadOfficer);

// Staff
router.get('/staff', apiController.getStaff);
router.post('/staff', isAdmin, upload.single('image'), apiController.createStaff);
router.put('/staff/:id', isAdmin, upload.single('image'), apiController.updateStaff);
router.delete('/staff/:id', isAdmin, apiController.deleteStaff);

// Programs
router.get('/programs', apiController.getPrograms);
router.post('/programs', isAdmin, upload.single('image'), apiController.createProgram);
router.put('/programs/:id', isAdmin, upload.single('image'), apiController.updateProgram);
router.delete('/programs/:id', isAdmin, apiController.deleteProgram);

// Events
router.get('/events', apiController.getEvents);
router.post('/events', isAdmin, upload.single('image'), apiController.createEvent);
router.put('/events/:id', isAdmin, upload.single('image'), apiController.updateEvent);
router.delete('/events/:id', isAdmin, apiController.deleteEvent);

// Facilities
router.get('/facilities', apiController.getFacilities);
router.post('/facilities', isAdmin, upload.array('images', 5), apiController.createFacility);
router.put('/facilities/:id', isAdmin, upload.array('images', 5), apiController.updateFacility);
router.delete('/facilities/:id', isAdmin, apiController.deleteFacility);
router.delete('/facility-photos/:id', isAdmin, apiController.deleteFacilityPhoto);

// Navigation
router.get('/navigations', apiController.getNavigations);
router.get('/navigations/:type/:node_id', apiController.getNavigationByDestination);
router.post('/navigations', isAdmin, upload.single('image'), apiController.createNavigation);
router.put('/navigations/:id', isAdmin, upload.single('image'), apiController.updateNavigation);
router.delete('/navigations/:id', isAdmin, apiController.deleteNavigation);
router.get('/destinations/search', apiController.searchDestinations);

// Filtered Data
router.get('/departments/by-campus/:campusId', apiController.getDepartmentsByCampus);
router.get('/offices/by-campus/:campusId', apiController.getOfficesByCampus);
router.get('/programs/by-campus/:campusId', apiController.getProgramsByCampus);
router.get('/campuses/:id', apiController.getCampusById);
router.get('/departments/:id', apiController.getDepartmentById);
router.get('/offices/:id', apiController.getOfficeById);

module.exports = router;
