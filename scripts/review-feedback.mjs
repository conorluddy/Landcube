/** Show recent PR feedback before pushing, without blocking pushes when GitHub is unavailable. */
import { execFileSync } from 'node:child_process';

function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

try {
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  const pr = JSON.parse(gh(['pr', 'view', branch, '--json', 'number,url,comments,reviews']));
  const inline = JSON.parse(
    gh(['api', `repos/{owner}/{repo}/pulls/${pr.number}/comments`, '--paginate', '--slurp']),
  ).flat();
  const feedback = [
    ...pr.comments.map((comment) => ({
      author: comment.author?.login,
      body: comment.body,
      url: comment.url,
    })),
    ...pr.reviews.map((review) => ({
      author: review.author?.login,
      body: review.body,
      url: review.url,
    })),
    ...inline.map((comment) => ({
      author: comment.user?.login,
      body: comment.body,
      url: comment.html_url,
    })),
  ].filter((item) => item.body?.trim());

  if (feedback.length) {
    process.stderr.write(`\nPR feedback for ${pr.url}:\n`);

    for (const item of feedback) {
      process.stderr.write(
        `\n--- ${item.author ?? 'Unknown'} ${item.url ?? ''} ---\n${item.body.trim()}\n`,
      );
    }

    process.stderr.write(
      '\nReview the linked feedback for actionable items. Summarize relevant items briefly and offer to address them.\n',
    );
  } else {
    process.stderr.write(`\nNo written feedback found for ${pr.url}.\n`);
  }
} catch {
  process.stderr.write(
    '\nPR feedback unavailable (no PR or GitHub could not be reached); continuing push.\n',
  );
}
