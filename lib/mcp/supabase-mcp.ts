import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const server = new Server(
  { name: 'scholarhaaab-supabase', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_student_profile',
      description: 'Get student profile and performance data',
      inputSchema: {
        type: 'object',
        properties: {
          student_id: { type: 'string', description: 'Student UUID' }
        },
        required: ['student_id']
      }
    },
    {
      name: 'get_weak_topics',
      description: 'Get student weak topics below 60% accuracy',
      inputSchema: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          subject: { type: 'string' }
        },
        required: ['student_id']
      }
    },
    {
      name: 'log_question_attempt',
      description: 'Log a student question attempt',
      inputSchema: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          subject: { type: 'string' },
          topic: { type: 'string' },
          is_correct: { type: 'boolean' },
          marks_obtained: { type: 'number' },
          marks_available: { type: 'number' }
        },
        required: ['student_id', 'subject', 'topic', 'is_correct']
      }
    },
    {
      name: 'get_dashboard_data',
      description: 'Get full dashboard data for student',
      inputSchema: {
        type: 'object',
        properties: {
          student_id: { type: 'string' }
        },
        required: ['student_id']
      }
    },
    {
      name: 'get_topic_mastery',
      description: 'Get mastery level for all topics',
      inputSchema: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          subject: { type: 'string' }
        },
        required: ['student_id']
      }
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {

      case 'get_student_profile': {
        const { data } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('id', args!.student_id as string)
          .single()
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }]
        }
      }

      case 'get_weak_topics': {
        let query = supabase
          .from('topic_mastery')
          .select('*')
          .eq('student_id', args!.student_id as string)
          .lt('accuracy_percentage', 60)
          .order('accuracy_percentage', { ascending: true })

        if (args!.subject) {
          query = query.eq('subject', args!.subject as string)
        }

        const { data } = await query
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }]
        }
      }

      case 'log_question_attempt': {
        const { error } = await supabase
          .from('question_attempts')
          .insert({
            student_id: args!.student_id,
            subject: args!.subject,
            topic: args!.topic,
            is_correct: args!.is_correct,
            marks_obtained: (args!.marks_obtained as number) || 0,
            marks_available: (args!.marks_available as number) || 1,
            attempted_at: new Date().toISOString()
          })
        return {
          content: [{
            type: 'text',
            text: error ? 'Failed: ' + error.message : 'Logged successfully'
          }]
        }
      }

      case 'get_dashboard_data': {
        const [profile, mastery, progress, sessions] =
          await Promise.all([
            supabase
              .from('student_profiles')
              .select('*')
              .eq('id', args!.student_id as string)
              .single(),
            supabase
              .from('topic_mastery')
              .select('*')
              .eq('student_id', args!.student_id as string)
              .order('accuracy_percentage', { ascending: true })
              .limit(10),
            supabase
              .from('daily_progress')
              .select('*')
              .eq('student_id', args!.student_id as string)
              .order('date', { ascending: false })
              .limit(7),
            supabase
              .from('study_sessions')
              .select('*')
              .eq('student_id', args!.student_id as string)
              .order('started_at', { ascending: false })
              .limit(5),
          ])

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              profile: profile.data,
              weak_topics: mastery.data?.filter(
                t => (t.accuracy_percentage || 0) < 60
              ),
              weekly_progress: progress.data,
              recent_sessions: sessions.data,
            })
          }]
        }
      }

      case 'get_topic_mastery': {
        let query = supabase
          .from('topic_mastery')
          .select('*')
          .eq('student_id', args!.student_id as string)

        if (args!.subject) {
          query = query.eq('subject', args!.subject as string)
        }

        const { data } = await query
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }]
        }
      }

      default:
        return {
          content: [{
            type: 'text',
            text: 'Unknown tool: ' + name
          }],
          isError: true
        }
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: 'Error: ' + String(error)
      }],
      isError: true
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('ScholarHAAB Supabase MCP running')
}

main().catch(console.error)
