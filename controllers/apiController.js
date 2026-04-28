const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Department, Campus, Office, Program, Event, HeadOfficer, Staff, Facility, CampusPhoto, OfficePhoto, Photo, Navigation, FacilityPhoto, User } = require('../models/index');

// --- Authentication ---

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'An error occurred during login' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
};

exports.checkAuth = (req, res) => {
    if (req.session.userId) {
        res.json({ success: true, username: req.session.username });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
};

// --- Navigation CRUD ---

exports.getNavigations = async (req, res) => {
    try {
        const navigations = await Navigation.findAll({
            order: [['node_id', 'ASC'], ['type', 'ASC'], ['step_order', 'ASC']]
        });
        res.json({ success: true, data: navigations });
    } catch (error) {
        console.error('Error fetching navigations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch navigations' });
    }
};

exports.getNavigationByDestination = async (req, res) => {
    try {
        const { type, node_id } = req.params;
        const navigations = await Navigation.findAll({
            where: { type, node_id },
            order: [['step_order', 'ASC']]
        });
        res.json({ success: true, data: navigations });
    } catch (error) {
        console.error('Error fetching navigation steps:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch navigation steps' });
    }
};

exports.createNavigation = async (req, res) => {
    console.log('Create Navigation Request received');
    try {
        const { node_id, type, directional_text, step_order } = req.body;
        console.log('Request Body:', { node_id, type, directional_text, step_order });
        
        const image_url = req.file ? req.file.path : null;
        console.log('Image URL from multer:', image_url);

        const nav = await Navigation.create({
            node_id,
            type,
            directional_text,
            step_order: step_order || 0,
            image_url
        });
        console.log('Navigation created in DB:', nav.id);

        res.status(201).json({ success: true, data: nav });
    } catch (error) {
        console.error('Error creating navigation step:', error);
        res.status(500).json({ success: false, message: 'Failed to create navigation step' });
    }
};

exports.updateNavigation = async (req, res) => {
    try {
        const { id } = req.params;
        const { directional_text, step_order } = req.body;
        const updateData = { directional_text, step_order };

        if (req.file) {
            updateData.image_url = req.file.path;
        }

        const [updated] = await Navigation.update(updateData, { where: { id } });

        if (updated) {
            const updatedNav = await Navigation.findByPk(id);
            return res.json({ success: true, data: updatedNav });
        }
        res.status(404).json({ success: false, message: 'Navigation step not found' });
    } catch (error) {
        console.error('Error updating navigation step:', error);
        res.status(500).json({ success: false, message: 'Failed to update navigation step' });
    }
};

exports.deleteNavigation = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Navigation.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Navigation step deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Navigation step not found' });
    } catch (error) {
        console.error('Error deleting navigation step:', error);
        res.status(500).json({ success: false, message: 'Failed to delete navigation step' });
    }
};

exports.searchDestinations = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: [] });

        const [depts, offices, facilities, events] = await Promise.all([
            Department.findAll({ where: { name: { [Sequelize.Op.like]: `%${q}%` } }, limit: 5 }),
            Office.findAll({ where: { name: { [Sequelize.Op.like]: `%${q}%` } }, limit: 5 }),
            Facility.findAll({ where: { name: { [Sequelize.Op.like]: `%${q}%` } }, limit: 5 }),
            Event.findAll({ where: { name: { [Sequelize.Op.like]: `%${q}%` } }, limit: 5 })
        ]);

        const results = [
            ...depts.map(d => ({ id: d.id, name: d.name, type: 'department' })),
            ...offices.map(o => ({ id: o.id, name: o.name, type: 'office' })),
            ...facilities.map(f => ({ id: f.id, name: f.name, type: 'facility' })),
            ...events.map(e => ({ id: e.id, name: e.name, type: 'event' }))
        ];

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error searching destinations:', error);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
};

// --- Dashboard ---

exports.getDashboardStats = async (req, res) => {
    try {
        // Parallel execution for better performance
        const [deptCount, officeCount, programCount, eventCount, facilityCount, staffCount, campusCount] = await Promise.all([
            Department.count(),
            Office.count(),
            Program.count(),
            Event.count(),
            Facility.count(),
            Staff.count(),
            Campus.count()
        ]);

        res.json({
            success: true,
            data: {
                departments: deptCount,
                offices: officeCount,
                programs: programCount,
                events: eventCount,
                facilities: facilityCount,
                staff: staffCount,
                campuses: campusCount
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
};

// --- Departments CRUD ---

exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            include: [
                { model: Campus, attributes: ['name'] },
                { model: Photo }
            ]
        });
        res.json({ success: true, data: departments });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch departments' });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        const { name, description, campus_id } = req.body;
        const main_image_url = req.files && req.files.length > 0 ? req.files[0].path : null;

        const department = await Department.create({
            name,
            description,
            campus_id,
            image_url: main_image_url
        });

        if (req.files && req.files.length > 0) {
            const photosData = req.files.map(file => ({
                image_url: file.path,
                type: 'department',
                department_id: department.id
            }));
            await Photo.bulkCreate(photosData);
        }

        res.status(201).json({ success: true, data: department });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ success: false, message: 'Failed to create department' });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, campus_id } = req.body;
        const updateData = { name, description, campus_id };

        if (req.files && req.files.length > 0) {
            updateData.image_url = req.files[0].path;
            
            // For simplicity, we'll replace existing photos if new ones are uploaded
            await Photo.destroy({ where: { department_id: id, type: 'department' } });
            
            const photosData = req.files.map(file => ({
                image_url: file.path,
                type: 'department',
                department_id: id
            }));
            await Photo.bulkCreate(photosData);
        }

        const [updated] = await Department.update(updateData, { where: { id } });

        if (updated) {
            const updatedDepartment = await Department.findByPk(id, { include: [Photo] });
            return res.json({ success: true, data: updatedDepartment });
        }
        res.status(404).json({ success: false, message: 'Department not found' });
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({ success: false, message: 'Failed to update department' });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Department.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Department deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Department not found' });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ success: false, message: 'Failed to delete department' });
    }
};

exports.deletePhoto = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Photo.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Photo deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Photo not found' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ success: false, message: 'Failed to delete photo' });
    }
};

// --- Campuses ---

exports.getCampuses = async (req, res) => {
    try {
        const campuses = await Campus.findAll();
        res.json({ success: true, data: campuses });
    } catch (error) {
        console.error('Error fetching campuses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch campuses' });
    }
};

exports.createCampus = async (req, res) => {
    try {
        const { name, location, about } = req.body;
        const campus = await Campus.create({ name, location, about });
        res.status(201).json({ success: true, data: campus });
    } catch (error) {
        console.error('Error creating campus:', error);
        res.status(500).json({ success: false, message: 'Failed to create campus' });
    }
};

exports.updateCampus = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, about } = req.body;
        const [updated] = await Campus.update({ name, location, about }, { where: { id } });
        if (updated) {
            const updatedCampus = await Campus.findByPk(id);
            return res.json({ success: true, data: updatedCampus });
        }
        res.status(404).json({ success: false, message: 'Campus not found' });
    } catch (error) {
        console.error('Error updating campus:', error);
        res.status(500).json({ success: false, message: 'Failed to update campus' });
    }
};

exports.deleteCampus = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Campus.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Campus deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Campus not found' });
    } catch (error) {
        console.error('Error deleting campus:', error);
        res.status(500).json({ success: false, message: 'Failed to delete campus' });
    }
};

// --- Offices ---

exports.getOffices = async (req, res) => {
    try {
        const offices = await Office.findAll({
            include: [
                { model: Campus, attributes: ['name'] },
                { model: OfficePhoto, as: 'OfficePhotos' }
            ]
        });
        res.json({ success: true, data: offices });
    } catch (error) {
        console.error('Error fetching offices:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch offices' });
    }
};

exports.createOffice = async (req, res) => {
    try {
        const { name, about, campus_id } = req.body;
        const office = await Office.create({ name, about, campus_id });

        if (req.files && req.files.length > 0) {
            const photosData = req.files.map(file => ({
                image_url: file.path,
                type: 'office',
                offices_id: office.id
            }));
            await OfficePhoto.bulkCreate(photosData);
        }

        res.status(201).json({ success: true, data: office });
    } catch (error) {
        console.error('Error creating office:', error);
        res.status(500).json({ success: false, message: 'Failed to create office' });
    }
};

exports.updateOffice = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, about, campus_id } = req.body;
        
        const [updated] = await Office.update({ name, about, campus_id }, { where: { id } });

        if (req.files && req.files.length > 0) {
            // For simplicity, we'll replace existing photos if new ones are uploaded
            await OfficePhoto.destroy({ where: { offices_id: id, type: 'office' } });
            
            const photosData = req.files.map(file => ({
                image_url: file.path,
                type: 'office',
                offices_id: id
            }));
            await OfficePhoto.bulkCreate(photosData);
        }

        if (updated || (req.files && req.files.length > 0)) {
            const updatedOffice = await Office.findByPk(id, { include: [{ model: OfficePhoto, as: 'OfficePhotos' }] });
            return res.json({ success: true, data: updatedOffice });
        }
        res.status(404).json({ success: false, message: 'Office not found' });
    } catch (error) {
        console.error('Error updating office:', error);
        res.status(500).json({ success: false, message: 'Failed to update office' });
    }
};

exports.deleteOfficePhoto = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await OfficePhoto.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Office photo deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Office photo not found' });
    } catch (error) {
        console.error('Error deleting office photo:', error);
        res.status(500).json({ success: false, message: 'Failed to delete office photo' });
    }
};

exports.deleteOffice = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Office.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Office deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Office not found' });
    } catch (error) {
        console.error('Error deleting office:', error);
        res.status(500).json({ success: false, message: 'Failed to delete office' });
    }
};

// --- Head Officers ---

exports.getHeadOfficers = async (req, res) => {
    try {
        const officers = await HeadOfficer.findAll({
            include: [
                { model: Department, attributes: ['name'] },
                { model: Office, attributes: ['name'] }
            ]
        });
        res.json({ success: true, data: officers });
    } catch (error) {
        console.error('Error fetching head officers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch head officers' });
    }
};

exports.createHeadOfficer = async (req, res) => {
    try {
        const { fullname, position, department_id, offices_id } = req.body;
        const image_url = req.file ? req.file.path : null;

        const officer = await HeadOfficer.create({
            fullname,
            position,
            department_id: department_id || null,
            offices_id: offices_id || null,
            image_url
        });

        res.status(201).json({ success: true, data: officer });
    } catch (error) {
        console.error('Error creating head officer:', error);
        res.status(500).json({ success: false, message: 'Failed to create head officer' });
    }
};

exports.updateHeadOfficer = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullname, position, department_id, offices_id } = req.body;
        const updateData = { 
            fullname, 
            position, 
            department_id: department_id || null,
            offices_id: offices_id || null
        };

        if (req.file) {
            updateData.image_url = req.file.path;
        }

        const [updated] = await HeadOfficer.update(updateData, { where: { id } });

        if (updated) {
            const updatedOfficer = await HeadOfficer.findByPk(id);
            return res.json({ success: true, data: updatedOfficer });
        }
        res.status(404).json({ success: false, message: 'Head officer not found' });
    } catch (error) {
        console.error('Error updating head officer:', error);
        res.status(500).json({ success: false, message: 'Failed to update head officer' });
    }
};

exports.deleteHeadOfficer = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await HeadOfficer.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Head officer deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Head officer not found' });
    } catch (error) {
        console.error('Error deleting head officer:', error);
        res.status(500).json({ success: false, message: 'Failed to delete head officer' });
    }
};

// --- Staff ---

exports.getStaff = async (req, res) => {
    try {
        const staff = await Staff.findAll({
            include: [
                { model: Office, attributes: ['name'] },
                { model: Department, attributes: ['name'] }
            ]
        });
        res.json({ success: true, data: staff });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch staff' });
    }
};

exports.createStaff = async (req, res) => {
    try {
        const { fullname, position, offices_id, department_id } = req.body;
        const image_url = req.file ? req.file.path : null;

        const staffMember = await Staff.create({
            fullname,
            position,
            offices_id: offices_id || null,
            department_id: department_id || null,
            image_url
        });

        res.status(201).json({ success: true, data: staffMember });
    } catch (error) {
        console.error('Error creating staff:', error);
        res.status(500).json({ success: false, message: 'Failed to create staff' });
    }
};

exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullname, position, offices_id, department_id } = req.body;
        const updateData = { 
            fullname, 
            position, 
            offices_id: offices_id || null,
            department_id: department_id || null
        };

        if (req.file) {
            updateData.image_url = req.file.path;
        }

        const [updated] = await Staff.update(updateData, { where: { id } });

        if (updated) {
            const updatedStaff = await Staff.findByPk(id);
            return res.json({ success: true, data: updatedStaff });
        }
        res.status(404).json({ success: false, message: 'Staff member not found' });
    } catch (error) {
        console.error('Error updating staff:', error);
        res.status(500).json({ success: false, message: 'Failed to update staff' });
    }
};

exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Staff.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Staff member deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Staff member not found' });
    } catch (error) {
        console.error('Error deleting staff:', error);
        res.status(500).json({ success: false, message: 'Failed to delete staff' });
    }
};

// --- Programs ---

exports.getPrograms = async (req, res) => {
    try {
        const programs = await Program.findAll({
            include: [{ 
                model: Department, 
                attributes: ['name'],
                include: [{ model: Campus, attributes: ['name', 'id'] }]
            }]
        });
        res.json({ success: true, data: programs });
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch programs' });
    }
};

exports.getDepartmentsByCampus = async (req, res) => {
    try {
        const { campusId } = req.params;
        const departments = await Department.findAll({ 
            where: { campus_id: campusId },
            include: [{ model: Photo }]
        });
        res.json({ success: true, data: departments });
    } catch (error) {
        console.error('Error fetching filtered departments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch departments' });
    }
};

exports.getOfficesByCampus = async (req, res) => {
    try {
        const { campusId } = req.params;
        const offices = await Office.findAll({ 
            where: { campus_id: campusId },
            include: [{ model: OfficePhoto, as: 'OfficePhotos' }]
        });
        res.json({ success: true, data: offices });
    } catch (error) {
        console.error('Error fetching filtered offices:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch offices' });
    }
};

exports.getProgramsByCampus = async (req, res) => {
    try {
        const { campusId } = req.params;
        const programs = await Program.findAll({
            include: [{
                model: Department,
                where: { campus_id: campusId },
                attributes: ['name']
            }]
        });
        res.json({ success: true, data: programs });
    } catch (error) {
        console.error('Error fetching filtered programs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch programs' });
    }
};

exports.getCampusById = async (req, res) => {
    try {
        const { id } = req.params;
        const campus = await Campus.findByPk(id, {
            include: [
                { model: CampusPhoto },
                { model: Department }
            ]
        });
        if (campus) {
            res.json({ success: true, data: campus });
        } else {
            res.status(404).json({ success: false, message: 'Campus not found' });
        }
    } catch (error) {
        console.error('Error fetching campus details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch campus details' });
    }
};

exports.getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await Department.findByPk(id, {
            include: [
                { model: Photo },
                { model: HeadOfficer },
                { model: Staff, as: 'Staff' },
                { model: Program },
                { model: Event },
                { 
                    model: Facility,
                    include: [{ model: FacilityPhoto, as: 'FacilityPhotos' }]
                }
            ]
        });
        if (department) {
            res.json({ success: true, data: department });
        } else {
            res.status(404).json({ success: false, message: 'Department not found' });
        }
    } catch (error) {
        console.error('Error fetching department details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch department details' });
    }
};

exports.getOfficeById = async (req, res) => {
    try {
        const { id } = req.params;
        const office = await Office.findByPk(id, {
            include: [
                { model: OfficePhoto, as: 'OfficePhotos' },
                { model: Staff, as: 'Staff' },
                { model: HeadOfficer }
            ]
        });
        if (office) {
            res.json({ success: true, data: office });
        } else {
            res.status(404).json({ success: false, message: 'Office not found' });
        }
    } catch (error) {
        console.error('Error fetching office details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch office details' });
    }
};

exports.createProgram = async (req, res) => {
    try {
        const { description_name, code_name, department_id } = req.body;
        const image_url = req.file ? req.file.path : null;

        const program = await Program.create({
            description_name,
            code_name,
            department_id,
            image_url
        });

        res.status(201).json({ success: true, data: program });
    } catch (error) {
        console.error('Error creating program:', error);
        res.status(500).json({ success: false, message: 'Failed to create program' });
    }
};

exports.updateProgram = async (req, res) => {
    try {
        const { id } = req.params;
        const { description_name, code_name, department_id } = req.body;
        const updateData = { description_name, code_name, department_id };

        if (req.file) {
            updateData.image_url = req.file.path;
        }

        const [updated] = await Program.update(updateData, { where: { id } });

        if (updated) {
            const updatedProgram = await Program.findByPk(id);
            return res.json({ success: true, data: updatedProgram });
        }
        res.status(404).json({ success: false, message: 'Program not found' });
    } catch (error) {
        console.error('Error updating program:', error);
        res.status(500).json({ success: false, message: 'Failed to update program' });
    }
};

exports.deleteProgram = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Program.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Program deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Program not found' });
    } catch (error) {
        console.error('Error deleting program:', error);
        res.status(500).json({ success: false, message: 'Failed to delete program' });
    }
};

// --- Events ---

exports.getEvents = async (req, res) => {
    try {
        const events = await Event.findAll({
            include: [{ 
                model: Department, 
                attributes: ['name'],
                include: [{ model: Campus, attributes: ['name', 'id'] }]
            }]
        });
        res.json({ success: true, data: events });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { 
            name, about, start_date, end_date, start_time, 
            end_time, venue, event_organizer_name, department_id 
        } = req.body;
        const event_organizer_image_url = req.file ? req.file.path : null;

        const event = await Event.create({
            name, about, start_date, end_date, start_time, 
            end_time, venue, event_organizer_name, department_id,
            event_organizer_image_url
        });

        res.status(201).json({ success: true, data: event });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, about, start_date, end_date, start_time, 
            end_time, venue, event_organizer_name, department_id 
        } = req.body;
        
        const updateData = { 
            name, about, start_date, end_date, start_time, 
            end_time, venue, event_organizer_name, department_id 
        };

        if (req.file) {
            updateData.event_organizer_image_url = req.file.path;
        }

        const [updated] = await Event.update(updateData, { where: { id } });

        if (updated) {
            const updatedEvent = await Event.findByPk(id);
            return res.json({ success: true, data: updatedEvent });
        }
        res.status(404).json({ success: false, message: 'Event not found' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Event.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Event deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Event not found' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
};

// --- Facilities ---

exports.getFacilities = async (req, res) => {
    try {
        const facilities = await Facility.findAll({
            include: [
                { 
                    model: Department, 
                    attributes: ['name'],
                    include: [{ model: Campus, attributes: ['name', 'id'] }]
                },
                { model: FacilityPhoto, as: 'FacilityPhotos' }
            ]
        });
        res.json({ success: true, data: facilities });
    } catch (error) {
        console.error('Error fetching facilities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities' });
    }
};

exports.createFacility = async (req, res) => {
    try {
        const { name, type, department_id } = req.body;
        const main_image_url = req.files && req.files.length > 0 ? req.files[0].path : null;

        const facility = await Facility.create({
            name,
            type,
            department_id,
            image_url: main_image_url
        });

        if (req.files && req.files.length > 0) {
            const photosData = req.files.map(file => ({
                image_url: file.path,
                facility_id: facility.id
            }));
            await FacilityPhoto.bulkCreate(photosData);
        }

        res.status(201).json({ success: true, data: facility });
    } catch (error) {
        console.error('Error creating facility:', error);
        res.status(500).json({ success: false, message: 'Failed to create facility' });
    }
};

exports.updateFacility = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, department_id } = req.body;
        const updateData = { name, type, department_id };

        if (req.files && req.files.length > 0) {
            updateData.image_url = req.files[0].path;
            
            // For simplicity, replace existing photos if new ones are uploaded
            await FacilityPhoto.destroy({ where: { facility_id: id } });
            
            const photosData = req.files.map(file => ({
                image_url: file.path,
                facility_id: id
            }));
            await FacilityPhoto.bulkCreate(photosData);
        }

        const [updated] = await Facility.update(updateData, { where: { id } });

        if (updated || (req.files && req.files.length > 0)) {
            const updatedFacility = await Facility.findByPk(id, { include: [{ model: FacilityPhoto, as: 'FacilityPhotos' }] });
            return res.json({ success: true, data: updatedFacility });
        }
        res.status(404).json({ success: false, message: 'Facility not found' });
    } catch (error) {
        console.error('Error updating facility:', error);
        res.status(500).json({ success: false, message: 'Failed to update facility' });
    }
};

exports.deleteFacility = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Facility.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Facility deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Facility not found' });
    } catch (error) {
        console.error('Error deleting facility:', error);
        res.status(500).json({ success: false, message: 'Failed to delete facility' });
    }
};

exports.deleteFacilityPhoto = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await FacilityPhoto.destroy({ where: { id } });
        if (deleted) {
            return res.json({ success: true, message: 'Facility photo deleted successfully' });
        }
        res.status(404).json({ success: false, message: 'Facility photo not found' });
    } catch (error) {
        console.error('Error deleting facility photo:', error);
        res.status(500).json({ success: false, message: 'Failed to delete facility photo' });
    }
};

// Existing placeholder functions (can be removed if no longer needed)
exports.getData = (req, res) => {
    res.json({ success: true, message: 'API is working' });
};

exports.postData = (req, res) => {
    res.status(201).json({ success: true, data: req.body });
};
