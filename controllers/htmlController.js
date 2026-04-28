const path = require('path');

exports.getHomePage = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/index.html'));
};

exports.getOcRootPage = (req, res) => {
    res.sendFile(path.join(__dirname, '../oc_offices_navigator.html'));
};

exports.getAdminSettings = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/background-settings.html'));
};

exports.getAdminDashboard = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/dashboard.html'));
};

exports.getManageCampuses = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/campuses.html'));
};

exports.getManageDepartments = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/departments.html'));
};

exports.getManageOffices = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/offices.html'));
};

exports.getManageHeadOfficer = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/head-officer.html'));
};

exports.getManageStaff = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/staff.html'));
};

exports.getManagePrograms = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/programs.html'));
};

exports.getManageEvents = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/events.html'));
};

exports.getManageFacilities = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/facilities.html'));
};

exports.getManageNavigation = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/admin/navigation.html'));
};

exports.getClientMain = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/client/oc-main.html'));
};

exports.getDepartment = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/client/department.html'));
};

exports.getListDepartments = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/client/list-departments.html'));
};

exports.getListOffices = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/client/list-offices.html'));
};

exports.getOffice = (req, res) => {
    res.sendFile(path.join(__dirname, '../html/client/office.html'));
};
