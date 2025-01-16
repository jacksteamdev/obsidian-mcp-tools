<svelte:head>
  <title>Understanding Express Routes: A Complete Guide</title>
  <meta name="description" content="Learn how to master Express.js routing with practical examples and best practices for building scalable Node.js applications." />
  <meta property="og:title" content="Understanding Express Routes: A Complete Guide" />
  <meta property="og:description" content="Learn how to master Express.js routing with practical examples and best practices for building scalable Node.js applications." />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://yoursite.com/blog/express-routes-guide" />
  <meta property="og:image" content="https://yoursite.com/images/express-routes-banner.jpg" />
  <meta name="author" content="Jane Doe" />
  <link rel="canonical" href="https://yoursite.com/blog/express-routes-guide" />
</svelte:head>

<article class="blog-post">
  <header>
    <h1>Understanding Express Routes: A Complete Guide</h1>
    <div class="metadata">
      <address class="author">
        <!-- svelte-ignore a11y_invalid_attribute -->
        By <a rel="author" href="#">Jane Doe</a>
      </address>
      <time datetime="2023-12-14">December 14, 2023</time>
    </div>
  </header>

  <section class="content">
    <h2>Introduction</h2>
    <p>Express.js has become the de facto standard for building web applications with Node.js. At its core, routing is one of the most fundamental concepts you need to master.</p>

    <h2>Basic Route Structure</h2>
    <p>Express routes follow a simple pattern that combines HTTP methods with URL paths:</p>
    
    <pre><code>{`
app.get('/users', (req, res) => {
  res.send('Get all users');
});
`}</code></pre>

    <h2>Route Parameters</h2>
    <p>Dynamic routes can be created using parameters:</p>
    
    <pre><code>{`
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.send(\`Get user \${userId}\`);
});
`}</code></pre>

    <h2>Middleware Integration</h2>
    <p>Routes can include middleware functions for additional processing:</p>
    
    <pre><code>{`
const authMiddleware = (req, res, next) => {
  // Authentication logic
  next();
};

app.get('/protected', authMiddleware, (req, res) => {
  res.send('Protected route');
});
`}</code></pre>
  </section>

  <footer>
    <div class="tags">
      <span class="tag">Express.js</span>
      <span class="tag">Node.js</span>
      <span class="tag">Web Development</span>
    </div>
    
    <div class="share">
      <h3>Share this article</h3>
      <nav class="social-links">
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a href="#">Twitter</a>
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a href="#">LinkedIn</a>
        <!-- svelte-ignore a11y_invalid_attribute -->
        <a href="#">Facebook</a>
      </nav>
    </div>
  </footer>
</article>

<style>
  .blog-post {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .metadata {
    color: #666;
    margin: 1rem 0;
  }

  .content {
    line-height: 1.6;
  }

  .tags {
    margin: 2rem 0;
  }

  .tag {
    background: #eee;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin-right: 0.5rem;
  }

  pre {
    background: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }
</style>
