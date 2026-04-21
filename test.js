const axios = require('http');
axios.get('http://localhost:3000/admin/activity', res => {
    let d='';
    res.on('data', c=>d+=c);
    res.on('end', ()=>console.log(d.slice(0, 500)));
});
