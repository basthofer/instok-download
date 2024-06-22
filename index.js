const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const fs = require('fs');
const axios = require('axios');
const instagramDl = require('@sasmeee/igdl');
const { Headers } = fetch;
const express = require('express');
const app = express();
const port = 3000;

const botToken = process.env.BOT_TOKEN || '';
 // Replace with your Telegram bot token
const bot = new Telegraf(botToken);

const headers = new Headers();

const getRedirectUrl = async (url) => {
    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
        url = await fetch(url, {
            redirect: "follow",
            follow: 10,
        });
        url = url.url;
        console.log("[*] Redirecting to: " + url);
    }
    return url;
};

const getIdVideo = async (url) => {
    if (url.includes("/t/")) {
        url = await new Promise((resolve) => {
            require("follow-redirects").https.get(url, function (res) {
                return resolve(res.responseUrl);
            });
        });
    }
    const matching = url.includes("/video/");
    const matchingPhoto = url.includes("/photo/");
    let idVideo = url.substring(
        url.indexOf("/video/") + 7,
        url.indexOf("/video/") + 26
    );
    if (matchingPhoto)
        idVideo = url.substring(
            url.indexOf("/photo/") + 7,
            url.indexOf("/photo/") + 26
        );
    else if (!matching) {
        throw new Error("URL not found");
    }
    return idVideo.length > 19
        ? idVideo.substring(0, idVideo.indexOf("?"))
        : idVideo;
};

const getVideo = async (url, watermark) => {
    const idVideo = await getIdVideo(url);
    const API_URL = `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${idVideo}&iid=7318518857994389254&device_id=7318517321748022790&channel=googleplay&app_name=musical_ly&version_code=300904&device_platform=android&device_type=ASUS_Z01QD&version=9`;
    const request = await fetch(API_URL, {
        method: "OPTIONS",
        headers: headers,
    });
    const body = await request.text();
    try {
        var res = JSON.parse(body);
    } catch (err) {
        console.error("Error:", err);
        console.error("Response body:", body);
        throw err;
    }

    if (res.aweme_list[0].aweme_id != idVideo) {
        return null;
    }

    let urlMedia = "";
    let image_urls = [];

    if (!!res.aweme_list[0].image_post_info) {
        console.log("[*] Video is slideshow");
        res.aweme_list[0].image_post_info.images.forEach((element) => {
            image_urls.push(element.display_image.url_list[1]);
        });
    } else {
        urlMedia = watermark
            ? res.aweme_list[0].video.download_addr.url_list[0]
            : res.aweme_list[0].video.play_addr.url_list[0];
    }

    return {
        url: urlMedia,
        images: image_urls,
        id: idVideo,
    };
};

const downloadMedia = async (item) => {
    const folder = "downloads/";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    if (item.images.length != 0) {
        console.log("[*] Downloading Slideshow");
        let index = 0;
        for (const image_url of item.images) {
            const fileName = `${item.id}_${index}.jpeg`;
            if (fs.existsSync(folder + fileName)) {
                console.log(`[!] File '${fileName}' already exists. Skipping`);
                continue;
            }
            index++;
            const response = await fetch(image_url);
            const buffer = await response.buffer();
            fs.writeFileSync(folder + fileName, buffer);
        }
    } else {
        const fileName = `${item.id}.mp4`;
        if (fs.existsSync(folder + fileName)) {
            console.log(`[!] File '${fileName}' already exists. Skipping`);
            return;
        }
        const response = await fetch(item.url);
        const buffer = await response.buffer();
        fs.writeFileSync(folder + fileName, buffer);
    }
};

bot.start((ctx) => ctx.reply('My love! send me a TikTok or Instagram video link baby 😘'));

bot.on('text', async (ctx) => {
    const url = ctx.message.text;

    if (!url.includes('instagram.com') && !url.includes('tiktok.com')) {
        return ctx.reply('Baby, the url is not correct...');
    }

    try {
        const processingMessage = await ctx.reply('🤗Honey, wait a bit my love. Processing the URL...');
        let data;
        if (url.includes('instagram.com')) {
            const dataList = await instagramDl(url);
            const downloadLink = dataList[0].download_link;
            const response = await axios.get(downloadLink, { responseType: 'stream' });
            await ctx.editMessageText('Uploading the video...my baby ><', { message_id: processingMessage.message_id });
            const filePath = `video_${Date.now()}.mp4`;
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                ctx.replyWithVideo({ source: filePath })
                    .then(() => {
                        fs.unlinkSync(filePath); // Delete the file after sending
                    })
                    .catch((error) => {
                        console.error('Error sending video:', error);
                        ctx.reply('Failed to send the video.');
                    });
            });

            writer.on('error', (error) => {
                console.error('Error downloading video:', error);
                ctx.reply('Failed to download the video.');
            });
        } else if (url.includes('tiktok.com')) {
            const processingMessage = await ctx.reply('🤗Honey, wait a bit my love. Processing the URL...');
            const resolvedUrl = await getRedirectUrl(url);
            data = await getVideo(resolvedUrl, false);

            if (data == null) {
                return ctx.reply('Video not found or has been deleted.');
            }

            await downloadMedia(data);

            if (data.images.length > 0) {
                data.images.forEach((image, index) => {
                    ctx.replyWithPhoto({ url: image });
                });
            } else {
                const filePath = `downloads/${data.id}.mp4`;
                await ctx.editMessageText('Uploading the video...my baby ><', { message_id: processingMessage.message_id });
                ctx.replyWithVideo({ source: filePath }, { caption: 'Downloaded TikTok Video' })
                    .then(() => {
                        fs.unlinkSync(filePath); // Delete the file after sending
                    })
                    .catch((error) => {
                        console.error('Error sending video:', error);
                        ctx.reply('Failed to send the video.');
                    });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        ctx.reply('Failed to process the URL.');
    }
});

bot.launch();

console.log('Bot is running...');

app.get('/download', async (req, res) => {
    const url = req.query.url;
    const watermark = req.query.watermark === 'true';

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const resolvedUrl = await getRedirectUrl(url);
        const data = await getVideo(resolvedUrl, watermark);

        if (data == null) {
            return res.status(404).json({ error: 'Video not found or has been deleted' });
        }

        await downloadMedia(data);

        if (data.images.length > 0) {
            res.json({
                message: 'Slideshow downloaded successfully',
                files: data.images.map((_, index) => `${data.id}_${index}.jpeg`)
            });
        } else {
            const filePath = `downloads/${data.id}.mp4`;
            res.download(filePath, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    res.status(500).json({ error: 'Error sending file' });
                }
                // Optionally delete the file after sending
                // fs.unlinkSync(filePath);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port,'0.0.0.0', () => {
    console.log(`TikTok Downloader API listening at http://localhost:${port}`);
});
