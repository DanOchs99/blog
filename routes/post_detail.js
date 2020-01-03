const express = require('express')
const router = express.Router()

router.get('/', (req,res) => {
  res.render('post_detail')
})

module.exports = router
