import { NowRequest, NowResponse } from '@vercel/node';
import { Server } from 'http';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import listen from 'test-listen';
import { createServer } from '../';

let server: Server;
let url: string;
let route: (req: NowRequest, res: NowResponse) => any;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (route) {
      return route(req, res);
    }
  });
  url = await listen(server);
});

afterAll(() => {
  server.close();
});

describe('responses', () => {
  it('text', async () => {
    // ARRANGE
    route = (_, res) => {
      // @ts-ignore: The official documentation claims this API exists
      res.text('Hello world');
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.data).toBe('Hello world');
  });

  it('send(string)', async () => {
    // ARRANGE
    route = (_, res) => {
      res.send('Hello world');
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.data).toBe('Hello world');
  });

  it('send(json)', async () => {
    // ARRANGE
    route = (_, res) => {
      res.send({ msg: 'Hello world' });
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.data).toEqual({ msg: 'Hello world' });
  });

  it('status', async () => {
    // ARRANGE
    route = (_, res) => {
      res.status(202).send(undefined);
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.status).toEqual(202);
  });

  it('json(obj)', async () => {
    // ARRANGE
    route = (_, res) => {
      res.json({
        msg: 'Hello world',
      });
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.data).toEqual({
      msg: 'Hello world',
    });
  });

  it('async', async () => {
    // ARRANGE
    route = async (_, res) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      res.send('Hello world');
    };

    // ACT
    const actual = await axios.get(url);

    // ASSERT
    expect(actual.data).toBe('Hello world');
  });
});

it('body - json', async () => {
  // ARRANGE
  let requestBody: any;
  route = (req, res) => {
    requestBody = req.body;
    res.send('ok');
  };

  // ACT
  await axios.post(
    url,
    {
      msg: 'Hello world',
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  // ASSERT
  expect(requestBody).toEqual({
    msg: 'Hello world',
  });
});

describe('request handling', () => {
  it('body - invalid json', async () => {
    // ARRANGE
    route = () => {};

    expect.assertions(2);

    // ACT
    try {
      await axios.post(
        url,
        `{
        msg: 'Hello world',
      `,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (err) {
      expect(err.response.status).toBe(400);
      expect(err.response.data).toBe('Invalid JSON');
    }
  });

  const formUrlEncoded = (x: object) =>
    Object.keys(x).reduce(
      // @ts-ignore
      (p, c) => p + `&${c}=${encodeURIComponent(x[c])}`,
      ''
    );

  it('body - form data', async () => {
    // ARRANGE
    let requestBody: any;
    route = (req, res) => {
      requestBody = req.body;
      res.send('ok');
    };

    // ACT
    await axios.post(
      url,
      formUrlEncoded({
        msg: 'Hello world',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // ASSERT
    expect(requestBody).toEqual({
      msg: 'Hello world',
    });
  });

  it('body - text', async () => {
    // ARRANGE
    let requestBody: any;
    route = (req, res) => {
      requestBody = req.body;
      res.send('ok');
    };

    // ACT
    await axios.post(url, 'Hello world', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    // ASSERT
    expect(requestBody).toEqual('Hello world');
  });

  it('body - unsupported', async () => {
    // ARRANGE
    let requestBody: any;
    route = (req, res) => {
      requestBody = req.body;
      res.send('ok');
    };

    // ACT
    await axios.post(url, 'Hello world', {
      headers: {
        'Content-Type': 'foo/bar',
      },
    });

    // ASSERT
    expect(requestBody).toEqual(undefined);
  });

  it('body - file', async () => {
    // ARRANGE
    let requestBody: any;
    route = (req, res) => {
      requestBody = req.body;
      res.send('ok');
    };
    const sourceFilePath = path.join(__dirname, 'avatar.png');

    // ACT
    await axios({
      method: 'POST',
      url,
      data: fs.createReadStream(sourceFilePath),
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    // ASSERT
    const expected = fs.readFileSync(path.join(__dirname, 'avatar.png'));
    expect(expected.equals(requestBody)).toBe(true);
  });

  it('cookies', async () => {
    // ARRANGE
    let requestCookies: any;
    route = (req, res) => {
      requestCookies = req.cookies;
      res.send('ok');
    };

    // ACT
    await axios.get(url, {
      headers: {
        Cookie: 'one=item1; two=item2;',
      },
    });

    // ASSERT
    expect(requestCookies).toEqual({
      one: 'item1',
      two: 'item2',
    });
  });

  it('query', async () => {
    // ARRANGE
    let requestQuery: any;
    route = (req, res) => {
      requestQuery = req.query;
      res.send('ok');
    };

    // ACT
    await axios.get(`${url}?one=item1&two=item2`);

    // ASSERT
    expect(requestQuery).toEqual({
      one: 'item1',
      two: 'item2',
    });
  });
});
