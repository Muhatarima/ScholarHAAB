export function isTrustedEvalRequest(req: Request) {
  return (
    process.env.ENABLE_EVAL_DEBUG === 'true' &&
    process.env.ALLOW_ANONYMOUS_PRODUCT_TESTS === 'true' &&
    req.headers.get('x-scholarhaab-eval') === 'true'
  )
}
