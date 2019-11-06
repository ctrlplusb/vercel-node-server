# zeit-node-server

An unofficial package allowing you to create Node Server instances of your Zeit `@now/node` lambdas.

Doing so allows you to write unit/integration tests for your routes.

[![npm](https://img.shields.io/npm/v/zeit-now-node-server.svg?style=flat-square)](http://npm.im/zeit-now-node-server)
[![MIT License](https://img.shields.io/npm/l/zeit-now-node-server.svg?style=flat-square)](http://opensource.org/licenses/MIT)
[![Travis](https://img.shields.io/travis/ctrlplusb/zeit-now-node-server.svg?style=flat-square)](https://travis-ci.org/ctrlplusb/zeit-now-node-server)
[![Codecov](https://img.shields.io/codecov/c/github/ctrlplusb/zeit-now-node-server.svg?style=flat-square)](https://codecov.io/github/ctrlplusb/zeit-now-node-server)

## Installation

```bash
npm install zeit-node-server
```

### Example Jest Test

```javascript
import { createServer } from 'zeit-now-node-server';
import listen from 'test-listen';
import axios from 'axios';
import routeUnderTest from './api/hello-world';

it('should allow me to test my node lambdas' async () => {
  const server = createServer(routeUnderTest);
  const url = await listen(server);
  const response = await axios.get(url);
  expect(response.data).toBe('Hello world');
  server.close();
});
```
