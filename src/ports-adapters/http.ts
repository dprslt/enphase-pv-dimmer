import got, { CancelableRequest, OptionsOfTextResponseBody, Response } from 'got';

const webGetTimeouts = {
    request: 4000,
    socket: 1000,
    send: 1000,
    response: 1000,
};

const timeHttpGetRaw = (url: string, opt: OptionsOfTextResponseBody = {}): CancelableRequest<Response<string>> => {
    return got.get(url, {
        timeout: webGetTimeouts,
        ...opt,
    });
};

export const timeHttpGetJson = async <T>(url: string, opt: OptionsOfTextResponseBody = {}): Promise<T> => {
    return timeHttpGetRaw(url, opt).json<T>();
};
export const timeHttpGetText = async (url: string, opt: OptionsOfTextResponseBody = {}): Promise<string> => {
    return timeHttpGetRaw(url, opt).text();
};
