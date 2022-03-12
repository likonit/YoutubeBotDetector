const express = require("express"), app = express(), Video = require("./Video"), path = require("path")
app.use(express.static(path.join(__dirname, "UI")))

app.listen(3000, () => {

    const Video = require("./Video")

    var video = new Video({
        VIDEO_ID: "s9vA7nEjtUc",
        weightLimit: 15
    })

    video.init()

    // app.get('/', (req, res) => {

	//     res.sendFile(__dirname + "/UI/index.html")

    // })

    // app.get('/checking', (req, res) => {

    //     // var video = new Video({
    //     //     VIDEO_ID: "urg4pPY5Rwc"
    //     // })
    
    //     // video.init()

    //     console.log(`Начало проверки видео https://youtube.com/watch?v=${req.query.v}`)
    //     res.end()
        
    // })

})