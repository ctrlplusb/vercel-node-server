import {
  NowRequestCookies,
  NowRequestQuery,
  NowRequestBody,
  NowRequest,
  NowResponse,
} from '@vercel/node';
import { IncomingMessage, ServerResponse, Server, RequestListener } from 'http';
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

export const enhanceRequest = async (
  req: IncomingMessage
): Promise<NowRequest> => {
  const bufferOrString = await buffer(req);
  return Object.assign(req, {
    body:
      typeof bufferOrString === 'string'
        ? bufferOrString
        : parseBody(req, bufferOrString),
    cookies: parseCookie(req),
    query: parseQuery(req),
  });
};

export const enhanceResponse = (res: ServerResponse): NowResponse => {
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
  return nowRes;
};

export interface Config {
  disableHelpers?: boolean;
}

interface DefaultConfig {
  disableHelpers: false;
}

type NowRoute = (req: NowRequest, res: NowResponse) => void;

export const createServer = <C extends Config = DefaultConfig>(
  route: C extends undefined
    ? NowRoute
    : C['disableHelpers'] extends true
    ? RequestListener
    : NowRoute,
  config?: C
) => {
  if (config != null && config.disableHelpers) {
    // @ts-expect-error
    return new Server(route);
  } else {
    return micro(async (req: IncomingMessage, res: ServerResponse) => {
      const nowReq = await enhanceRequest(req);
      const nowRes = enhanceResponse(res);
      return await route(nowReq, nowRes);
    });
  }
};
