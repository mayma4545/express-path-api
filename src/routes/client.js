const express = require('express');
const router = express.Router();

// Landing page (was index.html)
router.get('/', (req, res) => {
    res.render('client/index');
});
router.get('/index', (req, res) => {
    res.redirect('/');
});

// Home/Events page (was home.html)
router.get('/home', (req, res) => {
    res.render('client/home');
});

// Details view
router.get('/details', (req, res) => {
    res.render('client/details');
});

// Login view
router.get('/login', (req, res) => {
    res.render('client/login');
});

// Signup view
router.get('/signup', (req, res) => {
    res.render('client/signup');
});

// Map view
router.get('/map', (req, res) => {
    res.render('client/map');
});

module.exports = router;
