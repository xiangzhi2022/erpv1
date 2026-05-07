import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    return NextResponse.json({
      title: response.title,
      status_code: response.status_code,
      status_message: response.status_message,
      filetype: response.filetype,
      content: response.content,
    });
  } catch (error) {
    console.error('Error fetching PPT:', error);
    return NextResponse.json({ error: 'Failed to fetch PPT content' }, { status: 500 });
  }
}
