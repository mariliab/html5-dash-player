var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'HTML5 DASH Player by Eyevinn Technology' });
});

module.exports = router;
