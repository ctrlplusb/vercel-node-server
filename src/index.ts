import {
  NowRequestCookies,
  NowRequestQuery,
  NowRequestBody,
  NowRequest,
  NowResponse,
} from '@vercel/node';
import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'cookie';
import { parse as parseContentType } from 'content-type';
import { parse as parseQS } from 'querystring';
import { URL } from 'url';
import micro, { buffer, send } from 'micro';

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseBody(req: IncomingMessage, body: Buffer): NowRequestBody {
  if (!req.headers['content-type']) {
    return undefined;
  }

  const { type } = parseContentType(req.headers['content-type']);

  if (type === 'application/json') {
    try {
      return JSON.parse(body.toString());
    } catch (error) {
      throw new ApiError(400, 'Invalid JSON');
    }
  }

  if (type === 'application/octet-stream') {
    return body;
  }

  if (type === 'application/x-www-form-urlencoded') {
    // note: querystring.parse does not produce an iterable object
    // https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options
    return parseQS(body.toString());
  }

  if (type === 'text/plain') {
    return body.toString();
  }

  return undefined;
}

function parseQuery({ url = '/' }: IncomingMessage): NowRequestQuery {
  // we provide a placeholder base url because we only want searchParams
  const params = new URL(url, 'https://n').searchParams;

  const query: { [key: string]: string | string[] } = {};
  params.forEach((value, name) => {
    query[name] = value;
  });
  return query;
}

function parseCookie(req: IncomingMessage): NowRequestCookies {
  const header: undefined | string | string[] = req.headers.cookie;
  if (!header) {
    return {};
  }
  return parse(Array.isArray(header) ? header.join(';') : header);
}

export const createServer = (
  route: (req: NowRequest, res: NowResponse) => any | Promise<any>
) =>
  micro(async (req: IncomingMessage, res: ServerResponse) => {
    const bufferOrString = await buffer(req);
    const nowReq = Object.assign(req, {
      body:
        typeof bufferOrString === 'string'
          ? bufferOrString
          : parseBody(req, bufferOrString),
      cookies: parseCookie(req),
      query: parseQuery(req),
    });
    let _status: number;
    const nowRes = Object.assign(res, {
      status: (status: number) => {
        _status = status;
        return nowRes;
      },
      json: (jsonBody: any) => {
        send(nowRes, _status || 200, jsonBody);
        return nowRes;
      },
      send: (body: string | object | Buffer) => {
        send(nowRes, _status || 200, body);
        return nowRes;
      },
      text: (body: string) => {
        send(nowRes, _status || 200, body);
        return nowRes;
      },
    });
    return await route(nowReq, nowRes);
  });
