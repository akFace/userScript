# 一些自用油猴/暴力猴脚本

---

## 抖音/快手网页版全屏优化 16:9 显示，自动清屏/自动选择最高分辨率/隐藏控制栏/侧边栏/搜索栏-抖音|快手网页版优化

✅ 全屏 16:9 显示 <br />
✅ 隐藏控制栏/搜索栏 <br />
✅ 自动选择最高分辨率 <br />
✅ 自定义倒计时自动清屏 <br />
✅ 自定义显示/隐藏侧边栏 <br />
✅ 支持：抖音、快手 <br />

- 文件：`DY-KS-Quanping.user.js`
- 安装地址：[https://greasyfork.org/zh-CN/scripts/508672](https://greasyfork.org/zh-CN/scripts/508672)
- 设置方式

  ![image](https://raw.githubusercontent.com/akFace/userScript/master/images/Snipaste_2025-07-02_16-52-09.jpg)

### 开启前后对比

- 开启前
  ![image](https://raw.githubusercontent.com/akFace/userScript/master/images/Snipaste_2024-09-16_22-01-12.jpg)

- 开启后
  ![image](https://raw.githubusercontent.com/akFace/userScript/master/images/Snipaste_2024-09-16_22-00-42.jpg)

---

## 通用视频嗅探下载器

- 文件：`DownloadVideo.user.js`
- 安装地址：[https://github.com/akFace/userScript/raw/refs/heads/master/DownloadVideo.user.js](https://github.com/akFace/userScript/raw/refs/heads/master/DownloadVideo.user.js)
- 可下载绝大多数网页在线视频
- 设置方式
  ![image](https://raw.githubusercontent.com/akFace/userScript/master/images/Snipaste_2026-07-12_15-19-46.jpg)

- 修改了不主动嗅探功能，在需要的时候手动点击即可

- 原版作者地址：[查看](https://greasyfork.org/scripts/557721)，若有其他需求请反馈给原作者

---

## MusicFree 音乐播放器插件

- 文件：

  国际

  ```javascipt
   https://raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json
  ```

  国内

  ```javascipt
  https://gh-proxy.com/raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json
  ```

- [MusicFree 播放器](https://github.com/maotoumao/MusicFree)

---

## 115 网盘直链

- 伪装 115 浏览器下载
- 文件： `fake115d.user.js`

## 全局回到顶部（Back To Top）

- 文件： `BackTop.user.js`

- 安装地址：[https://greasyfork.org/zh-CN/scripts/561252](https://greasyfork.org/zh-CN/scripts/561252)

- 网站向下滚动时，出现回到顶部按钮，点击回到顶部 Back To Top，支持 YouTube、GitHub、steam、reddit、instagram、推特 x 等等所有网站

![image](https://github.com/akFace/picx-images-hosting/raw/master/Tools/pasted-svg.32ifznbp8l.webp)

- 如果不想要全部网站显示，编辑脚本，删除以下代码

```js
// @match        http://*/*
// @match        https://*/*
```

- 需要的网站添加

```js
// 示例：YouTube 下方添加自己需要的网站即可，比如 B 站*://*.bilibili.com/*
// @match        *://*.youtube.com/*
// @match        *://*.bilibili.com/*
```
