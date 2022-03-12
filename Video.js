// modules

const fs = require('fs'), jimp = require('jimp'), readline = require('readline')
// start propertyes

const colors = JSON.parse(fs.readFileSync("colors.json", 'utf-8')).array, SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly', 
  'https://www.googleapis.com/auth/youtube.force-ssl'
], TOKEN_PATH = "storedTokens.json"

var {google} = require('googleapis'), OAuth2 = google.auth.OAuth2, 
   users = JSON.parse(fs.readFileSync("data/userNames.json", "utf8")), 
   videos = JSON.parse(fs.readFileSync("data/videoNames.json", "utf8")),
   videosData = JSON.parse(fs.readFileSync("data/videosData.json", "utf8")),
   defaultUsers = JSON.parse(fs.readFileSync("data/default.json", "utf8")),
   suspectedUsers = JSON.parse(fs.readFileSync("data/suspected.json", "utf8")),
   videoData

module.exports = class Video {

    constructor(props) {

        this.VIDEO_ID = props.VIDEO_ID
        this.IMAGE_CHECKING = props.IMAGE_CHECKING ? props.IMAGE_CHECKING : true
        this.weightLimit = props.weightLimit ? props.weightLimit : 16
        this.count = {
          checked: 0,
          suspected: 0
        }
        this.isFirstToken = true

        if (!videos.find(item => item == this.VIDEO_ID)) {

            videos.push(this.VIDEO_ID)
            fs.writeFileSync("data/videoNames.json", JSON.stringify(videos))
        
            videosData.push({
                id: this.VIDEO_ID,
                link: "https://www.youtube.com/watch?v=" + this.VIDEO_ID,
                checked: 0,
                suspected: 0,
                procent: 0.0
            })
      
        } 

        videoData = videosData[videosData.length-1]

    }

    init() {

        fs.readFile('client_secret.json', (err, content) => {

            if (err) {

                console.log('Error loading client secret file: ' + err)
                return

            }

            this.authorize(JSON.parse(content), dt => this.getComments(dt))

        })
    
    }

    authorize(credentials, _callback) {

        var clientSecret = credentials.web.client_secret
        var clientId = credentials.web.client_id
        var redirectUrl = credentials.web.redirect_uris[0]
        var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl)

        fs.readFile(TOKEN_PATH, 'utf8', (err, token) => {

            if (err || !token) this.getNewToken(oauth2Client, _callback) 
            else {

                oauth2Client.credentials = JSON.parse(token)
                _callback(oauth2Client)

            }

        })

    }

    getNewToken(oauth2Client, _callback) {

        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        })

        console.log('Авторизуйся по этой ссылке: ', authUrl)

        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        rl.question('Введи токен из ссылки выше: ', code => {

            rl.close()
            oauth2Client.getToken(code, (err, token) => {

                if (err) {

                    console.log('Error while trying to retrieve access token', err)
                    return

                }

                oauth2Client.credentials = token
                this.storeToken(token)
                _callback(oauth2Client)

            })

        })

    }

    storeToken(token) {

        console.log('???')

        fs.writeFile(TOKEN_PATH, JSON.stringify({...token}), (err) => {

            if (err) throw err
            console.log('Token stored to ' + TOKEN_PATH)

        })

    }

    getComments(auth, pageToken) {
      
        var globLength, s = google.youtube('v3')

        s.commentThreads.list({
          auth: auth,
          videoId: this.VIDEO_ID,
          part: "snippet",
          pageToken: pageToken ? pageToken : undefined,
          maxResults: 100,
          textFormat: "plainText"
        }, (err, response) => {

            if (this.isFirstToken) this.isFirstToken = false
            else if (!pageToken) {

                console.log('Видео проверено.')
                return
            
            }

            if (err) {

                console.log('The API returned an error: ' + err)
                this.getNewToken(auth, this.getComments)
                return

            }

            response.data.items.map(item => {

                let userName = item.snippet.topLevelComment.snippet.authorChannelId.value,
                    defUser = defaultUsers.find(item => item.id == userName),
                    susUset = suspectedUsers.find(item => item.id == userName)

                globLength = response.data.items.length

                if (defUser) {

                    this.count.checked++

                    if (this.count.checked == globLength) {

                        this.endChecking(auth, response.data.nextPageToken, globLength)

                    }

                    return false

                }

                if (susUset) {

                    susUset.comments.push({
                        text: item.snippet.topLevelComment.snippet.textDisplay,
                        link: videoData.link
                    })

                    this.count.suspected++
                    this.count.checked++
                    if (this.count.checked == globLength) {

                        this.endChecking(auth, response.data.nextPageToken, globLength)

                    }
                    return false

                }

                let p = new Promise(res => {

                    this.getInfo({
                      func: ["channels", "list"],
                      part: "snippet,statistics,status,brandingSettings",
                      id: {id: userName}
                    }, auth, res)

                })

                p.then(data => {

                    let weight = 0

                    if (data.snippet.title.split(' ').length == 2) weight -= 1
                    if (data.snippet.title.split(' ').length == 1) weight += 1
                    if (data.snippet.title.split(' ').length > 2) weight -= 3

                    if (data.snippet.description === '') weight += 1
                    else {

                        if (data.snippet.description.length < 50) weight -= 2
                        else weight -= 5
                      
                    }

                    if (+data.snippet.publishedAt.substr(0, 4) > 2012) {

                        switch(+data.snippet.publishedAt.substr(0, 4)) {

                            case 2013:
                              weight += 0

                            case 2014:
                              weight += 1

                            case 2015:
                              weight += 1

                            case 2016:
                              weight += 0

                            case 2017:
                              weight += 0

                            case 2018:
                              weight += 2

                            case 2019:
                              weight += 4

                            case 2020:
                              weight += 4

                            case 2021:
                              weight += 4

                            case 2022:
                              weight += 6

                        }

                    } else {

                      weight -= 2012 - +data.snippet.publishedAt.substr(0, 4)

                    }

                    if (data.brandingSettings.image) weight -= 2

                    if (+data.statistics.viewCount != 0) weight -= 1
                    else weight += 1

                    if (+data.statistics.viewCount > 100) {

                        weight -= 3
                        weight -= Math.floor((+data.statistics.viewCount-100) / 200)

                    }

                    if (+data.statistics.subscriberCount > 4) {

                        weight -= 1
                        weight -= Math.floor((+data.statistics.subscriberCount-4) / 5)

                    } weight += 1

                    if (+data.statistics.videoCount > 2) {

                        weight -= 1
                        weight -= Math.floor((+data.statistics.videoCount-2) / 2)

                    } else weight += 1

                    let p2 = new Promise(res => {

                        this.getInfo({
                            func: ["subscriptions", "list"],
                            part: "snippet,contentDetails",
                            id: {channelId: userName}
                        }, auth, res)

                    })

                    p2.then(d => {

                        if (d.blocked) weight += 1
                        else {

                            if (d.pageInfo.totalResults < 20) weight += 2
                            else {

                                weight -= 1 
                                weight -= Math.floor((d.pageInfo.totalResults-20) / 20)

                            }

                        }

                        let p3 = new Promise(res => {

                            this.getInfo({
                                func: ["playlists", "list"],
                                part: "snippet,contentDetails",
                                id: {channelId: userName},
                            }, auth, res)
                            
                        })

                        p3.then(d1 => {

                          if (d1.length > 1) {

                            weight -= 1
                            if (d1.length >= 5) weight -= 3

                          } else weight += 1

                          d1.map(_item => {

                            if (_item.contentDetails.itemCount < 12) {

                              if (d1.length > 2) weight += 1
                              else weight += 2

                            } else {

                              if (d1.length == 1) {

                                if (_item.contentDetails.itemCount < 12) weight += 3
                                
                              } else {

                                weight -= 2
                                weight -= Math.floor((_item.contentDetails.itemCount-12) / 30)

                              }

                            }

                          })

                            var p4 = new Promise(res => {

                                if (!this.IMAGE_CHECKING) res()
                                else {

                                    jimp.read(data.snippet.thumbnails.default.url, (err, image) => {

                                        let obj = jimp.intToRGBA(image.getPixelColor(3, 3))

                                        function checkColor(itm) {

                                                var toRet

                                                colors.map(_itm => {

                                                    if (_itm[0] == itm.r && _itm[1] == itm.g
                                                    && _itm[2] == itm.b) {

                                                        toRet = {r: _itm[0], g: _itm[1], b: _itm[2]}
                                                        return

                                                    }

                                                })

                                                return toRet

                                        }

                                        let oldObj = checkColor(obj)

                                        if (oldObj) {

                                            let obj = jimp.intToRGBA(image.getPixelColor(5, 6))
                                            if (checkColor(obj) && oldObj.r == checkColor(obj).r) 
                                            weight += 4

                                            else weight -= 3

                                        } else weight -= 3

                                        res()

                                    })

                                }

                            })

                            p4.then(() => {

                                this.count.checked++

                                if (weight >= this.weightLimit) this.count.suspected++

                                if (weight >= this.weightLimit) {
                                    
                                    suspectedUsers.push({
                                        isSuspect: weight >= this.weightLimit,
                                        id: data.id,
                                        link: "https://www.youtube.com/channel/" + data.id,
                                        rating: weight,
                                        comments: [{
                                            text: item.snippet.topLevelComment.snippet.textDisplay,
                                            link: videoData.link
                                        }]
                                    })

                                    fs.writeFileSync("data/suspected.json", JSON.stringify(suspectedUsers))
                                
                                }

                                else {

                                    defaultUsers.push({
                                        isSuspect: weight >= this.weightLimit,
                                        id: data.id,
                                        link: "https://www.youtube.com/channel/" + data.id,
                                        rating: weight,
                                        comments: [{
                                            text: item.snippet.topLevelComment.snippet.textDisplay,
                                            link: videoData.link
                                        }]
                                    })

                                    fs.writeFileSync("data/default.json", JSON.stringify(defaultUsers))

                                }

                                fs.writeFileSync("data/userNames.json", JSON.stringify(users))
                                users.push(data.id)

                                if (this.count.checked == globLength) {

                                    this.endChecking(auth, response.data.nextPageToken, globLength)

                                }

                            })

                        })

                    })

                })

            })

        })

    }

    endChecking(auth, tkn, globLength) {

        videoData.checked += this.count.checked
        videoData.suspected += this.count.suspected
        videoData.procent = (videoData.suspected / videoData.checked * 100)
                            .toFixed(3)

        fs.writeFileSync(`data/videosData.json`, JSON.stringify(videosData))

        console.log(`Проверка ${globLength} завершена. ${
          this.count.suspected
        }/${this.count.checked}. ${videoData.procent}%`)

        this.count.checked = 0
        this.count.suspected = 0

        if (globLength) this.getComments(auth, tkn)
        else console.log('Проверка видео завершена')

    }

    getInfo(props, auth, _callback) {

        var s = google.youtube('v3')

        s[props.func[0]][props.func[1]]({
          auth: auth,
          ...props.id,
          part: props.part
        }, (err, response) => {

            if (err) {
                
                if (props.func[0] == 'subscriptions') _callback({blocked: true})
                    else console.log('The API returned an error [1]: ' + err)

                return

            }
            
            switch(props.func[0]) {

                case 'subscriptions': 
                    _callback(response.data)
                    break
                case 'channels':
                    _callback(response.data.items[0])
                    break
                case 'playlists':
                    _callback(response.data.items)
                    break
            }

        })

    }

}