### Authorization

All requests must use the following headers:

```javascript
token: YOUR_TOKEN,
Content-Type: application/json
```

---

### Body Request

```javascript
{
  "url": String,
  "type": String
}
```

| Parameter |  Description                   |
| --------- |  ----------------------------- |
| **url**   |  Video/audio URL from platform |
| **type**  |  Select **video** or **audio** |


### Response

```javascript
{
    "status": String,
    "platform": String,
    "type": String,
    "duration": Number,
    "filename": String,
    "title": String,
    "url": Url,
    "download": Url,
    "created_at": Datetime,
    "expired_at": Datetime
}
```

### Supported Platforms

| Platform    | URL Pattern Example                              |
| ----------- | ------------------------------------------------ |
| YouTube     | `https://www.youtube.com/...`          |
| Facebook    | `https://www.facebook.com/...`                   |
| Instagram   | `https://www.instagram.com/...`                  |
| TikTok      | `https://www.tiktok.com/...`                     |
| Twitter/X   | `https://twitter.com/...` or `https://x.com/...` |
| Dailymotion | `https://www.dailymotion.com/...`          |
| Vimeo       | `https://vimeo.com/...`                          |
| SoundCloud  | `https://soundcloud.com/...`                     |
| VK          | `https://vk.com/...`                             |
