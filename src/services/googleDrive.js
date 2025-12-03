import { gapi } from 'gapi-script';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.appdata';

let tokenClient;
let accessToken = null;

export const getAccessToken = () => accessToken;

export const initGoogleClient = () => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (response) => {
                    if (response.error !== undefined) {
                        reject(response);
                    }
                    accessToken = response.access_token;
                    gapi.load('client', async () => {
                        await gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                        });
                        resolve(accessToken);
                    });
                },
            });
            resolve(true);
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

export const signIn = () => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject("Token Client not initialized");
        tokenClient.callback = async (resp) => {
            if (resp.error) {
                reject(resp);
                return;
            }
            accessToken = resp.access_token;

            try {
                await new Promise((resolveGapi) => gapi.load('client', resolveGapi));

                if (gapi.client.setToken) {
                    gapi.client.setToken({ access_token: accessToken });
                }

                await gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [],
                });

                await gapi.client.load('drive', 'v3');

                const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }).then(res => {
                    if (!res.ok) throw new Error('Failed to fetch user info');
                    return res.json();
                });

                console.log("Sign in successful, user:", userInfo);
                resolve(userInfo);
            } catch (error) {
                console.error("Error during sign-in flow:", error);
                reject(error);
            }
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
};

export const signOut = () => {
    const token = accessToken;
    if (token) {
        google.accounts.oauth2.revoke(token, () => {
            console.log('Access Token revoked');
        });
    }
    accessToken = null;
};

export const listAudiobooks = async () => {
    if (!accessToken) throw new Error("Not authenticated");

    const searchResponse = await gapi.client.drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and name contains 'Harry Potter' and trashed = false",
        fields: 'files(id, name)',
    });

    const hpFolders = searchResponse.result.files;
    if (!hpFolders || hpFolders.length === 0) return [];

    const parentId = hpFolders[0].id;

    const booksResponse = await gapi.client.drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'nextPageToken, files(id, name)',
        orderBy: 'name',
    });

    return booksResponse.result.files;
};

export const listChapters = async (folderId) => {
    if (!accessToken) throw new Error("Not authenticated");
    const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        orderBy: 'name',
    });

    // Filter to only audio files
    const audioFiles = (response.result.files || []).filter(file =>
        file.mimeType && (
            file.mimeType.startsWith('audio/') ||
            file.name.toLowerCase().endsWith('.mp3') ||
            file.name.toLowerCase().endsWith('.m4a') ||
            file.name.toLowerCase().endsWith('.wav')
        )
    );

    console.log("Audio files found:", audioFiles.length);

    return audioFiles;
};

const PROGRESS_FILE_NAME = 'hp_audio_progress.json';

export const saveProgress = async (progressData) => {
    if (!accessToken) return;

    try {
        const listResponse = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name = '${PROGRESS_FILE_NAME}'`,
            fields: 'files(id)',
        });

        const fileId = listResponse.result.files[0]?.id;
        const fileContent = JSON.stringify(progressData);
        const fileMetadata = {
            name: PROGRESS_FILE_NAME,
            mimeType: 'application/json',
            parents: ['appDataFolder'],
        };

        const multipartRequestBody =
            `\r\n--foo_bar_baz\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(fileMetadata)}\r\n` +
            `--foo_bar_baz\r\nContent-Type: application/json\r\n\r\n${fileContent}\r\n` +
            `--foo_bar_baz--`;

        if (fileId) {
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz',
                },
                body: multipartRequestBody,
            });
        } else {
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz',
                },
                body: multipartRequestBody,
            });
        }
    } catch (error) {
        console.error("Failed to save progress", error);
    }
};

export const loadProgress = async () => {
    if (!accessToken) return {};

    try {
        const listResponse = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name = '${PROGRESS_FILE_NAME}'`,
            fields: 'files(id)',
        });

        const fileId = listResponse.result.files[0]?.id;
        if (!fileId) return {};

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        return response.result || {};
    } catch (error) {
        console.error("Failed to load progress", error);
        return {};
    }
};
