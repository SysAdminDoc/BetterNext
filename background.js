/**
 * BetterNext - Background Service Worker
 * Handles API requests to bypass CORS restrictions
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_REQUEST') {
        handleApiRequest(request)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
    
    if (request.type === 'FETCH_TEXT') {
        handleFetchText(request)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function handleApiRequest(request) {
    const { method, url, apiKey, body } = request;
    
    const headers = {
        'X-Api-Key': apiKey
    };
    
    if (body) {
        headers['Content-Type'] = 'application/json;charset=utf-8';
    }
    
    const response = await fetch(url, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined
    });
    
    if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } else if (response.status === 404 && method === 'DELETE') {
        return {};
    } else {
        let errorMsg = `${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData?.errors?.[0]?.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
    }
}

async function handleFetchText(request) {
    const { url } = request;
    
    const response = await fetch(url);
    
    if (response.ok) {
        return await response.text();
    } else {
        throw new Error(`Failed to fetch: ${response.statusText}`);
    }
}
