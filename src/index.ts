import {
  NowRequestCookies,
  NowRequestQuery,
  NowRequestBody,
  NowRequest,
  NowResponse,
} from '@vercel/node';
import { IncomingMessage, ServerResponse, Server, RequestListener } from 'http';
import micro, { buffer, send } from 'micro';
// @ts-expect-error
import cloneResponse from 'clone-response';

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getBodyParser(req: NowRequest, body: Buffer | string) {
  return function parseBody(): NowRequestBody {
    if (!req.headers['content-type']) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { parse: parseContentType } = require('content-type');
    const { type } = parseContentType(req.headers['content-type']);

    if (type === 'application/json') {
      try {
        const str = body.toString();
        return str ? JSON.parse(str) : {};
      } catch (error) {
        throw new ApiError(400, 'Invalid JSON');
      }
    }

    if (type === 'application/octet-stream') {
      return body;
    }

    if (type === 'application/x-www-form-urlencoded') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { parse: parseQS } = require('querystring');
      // note: querystring.parse does not produce an iterable object
      // https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options
      return parseQS(body.toString());
    }

    if (type === 'text/plain') {
      return body.toString();
    }

    return undefined;
  };
}

function getQueryParser({ url = '/' }: NowRequest) {
  return function parseQuery(): NowRequestQuery {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { parse: parseURL } = require('url');
    return parseURL(url, true).query;
  };
}

function getCookieParser(req: NowRequest) {
  return function parseCookie(): NowRequestCookies {
    const header: undefined | string | string[] = req.headers.cookie;

    if (!header) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { parse } = require('cookie');
    return parse(Array.isArray(header) ? header.join(';') : header);
  };
}

function setLazyProp<T>(req: NowRequest, prop: string, getter: () => T) {
  const opts = { configurable: true, enumerable: true };
  const optsReset = { ...opts, writable: true };

  Object.defineProperty(req, prop, {
    ...opts,
    get: () => {
      const value = getter();
      // we set the property on the object to avoid recalculating it
      Object.defineProperty(req, prop, { ...optsReset, value });
      return value;
    },
    set: value => {
      Object.defineProperty(req, prop, { ...optsReset, value });
    },
  });
}

export const enhanceRequest = async (req: NowRequest): Promise<NowRequest> => {
  // We clone the request, so that we can read the incoming stream but then
  // still allow subsequent consumers to do the same
  const reqClone = cloneResponse(req);
  const newReq = cloneResponse(req);
  const body = await buffer(reqClone);

  setLazyProp<NowRequestCookies>(newReq, 'cookies', getCookieParser(newReq));
  setLazyProp<NowRequestQuery>(newReq, 'query', getQueryParser(newReq));
  if (body != null) {
    setLazyProp<NowRequestBody>(newReq, 'body', getBodyParser(newReq, body));
  }

  return newReq;
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
      // @ts-expect-error
      const nowReq = await enhanceRequest(req);
      const nowRes = enhanceResponse(res);
      return await route(nowReq, nowRes);
    });
  }
};
