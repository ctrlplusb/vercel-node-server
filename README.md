# zeit-node-server

An unofficial package allowing you to create Node Server instances of your Zeit `@now/node` lambdas.

Doing so allows you to write unit/integration tests for your routes.

## Installation

```bash
npm install zeit-node-server
```

### Example Jest Test

```javascript
import createServer from 'zeit-now-node-server';
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
