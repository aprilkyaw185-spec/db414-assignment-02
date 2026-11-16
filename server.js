const http = require('http');

// In-memory mock database
let inventory = [
  { sku: "INV-101", name: "Wireless Mouse", category: "electronics", quantity: 50, price: 25.99 },
  { sku: "INV-102", name: "Mechanical Keyboard", category: "electronics", quantity: 30, price: 79.99 },
  { sku: "INV-103", name: "Standing Desk", category: "furniture", quantity: 10, price: 299.99 },
  { sku: "INV-104", name: "Ergonomic Chair", category: "furniture", quantity: 15, price: 199.99 }
];

const server = http.createServer((req, res) => {
  // Construct absolute URL using host header for WHATWG URL API
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // Audit log for every inbound request
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} - IP: ${req.socket.remoteAddress}`);

  // ==========================================
  // 1. GET /api/inventory with Query Filtering
  // ==========================================
  if (pathname === '/api/inventory' && req.method === 'GET') {
    const category = reqUrl.searchParams.get('category');
    const minPrice = reqUrl.searchParams.get('minPrice');

    let results = [...inventory];

    // Filter by category if provided
    if (category) {
      results = results.filter(item => item.category.toLowerCase() === category.toLowerCase());
    }

    // Filter by minimum price if provided
    if (minPrice) {
      const priceNum = parseFloat(minPrice);
      if (!isNaN(priceNum)) {
        results = results.filter(item => item.price >= priceNum);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'success',
      count: results.length,
      data: results
    }, null, 2));
  }

  // ==========================================
  // 2. POST /api/inventory with Validation & Stream Buffering
  // ==========================================
  if (pathname === '/api/inventory' && req.method === 'POST') {
    let bodyChunks = [];

    req.on('data', chunk => {
      bodyChunks.push(chunk); // Buffer raw incoming TCP chunks
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(bodyChunks).toString();

      // Defensive coding: catch malformed JSON syntax -> 400 Bad Request
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: "Bad Request: Malformed JSON syntax"
        }, null, 2));
      }

      // Validate 4 required fields: sku, name, quantity, price
      const { sku, name, quantity, price } = payload;
      if (!sku || !name || quantity === undefined || price === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: "Validation Failed: 4 required fields (sku, name, quantity, price) must be provided."
        }, null, 2));
      }

      // Create new inventory resource
      const newItem = {
        sku,
        name,
        category: payload.category || 'general',
        quantity,
        price,
        createdAt: new Date().toISOString()
      };
      
      inventory.push(newItem);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        message: "Inventory item created successfully",
        data: newItem
      }, null, 2));
    });

    return;
  }

  // Handle 404 Not Found for unmapped routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: "Route not found" }, null, 2));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Inventory server running on http://localhost:${PORT}`);
});