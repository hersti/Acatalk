export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_suggestions: {
        Row: {
          admin_note: string | null
          ai_confidence: number | null
          ai_reason: string | null
          class_year: string | null
          course_code: string | null
          course_name: string | null
          created_at: string
          department: string | null
          explanation: string | null
          faculty: string | null
          id: string
          inserted_id: string | null
          normalized_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          type: string
          university: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          ai_confidence?: number | null
          ai_reason?: string | null
          class_year?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          department?: string | null
          explanation?: string | null
          faculty?: string | null
          id?: string
          inserted_id?: string | null
          normalized_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type: string
          university: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          ai_confidence?: number | null
          ai_reason?: string | null
          class_year?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          department?: string | null
          explanation?: string | null
          faculty?: string | null
          id?: string
          inserted_id?: string | null
          normalized_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          type?: string
          university?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          name: string
          threshold: number
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          key: string
          name: string
          threshold?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          threshold?: number
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          like_count: number | null
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          like_count?: number | null
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          like_count?: number | null
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          hidden_for_user1: boolean
          hidden_for_user2: boolean
          id: string
          last_message_at: string | null
          rejected_at: string | null
          status: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          hidden_for_user1?: boolean
          hidden_for_user2?: boolean
          id?: string
          last_message_at?: string | null
          rejected_at?: string | null
          status?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          hidden_for_user1?: boolean
          hidden_for_user2?: boolean
          id?: string
          last_message_at?: string | null
          rejected_at?: string | null
          status?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      course_resources: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          resource_type: string
          title: string
          url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resource_type?: string
          title: string
          url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resource_type?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_wikis: {
        Row: {
          course_id: string
          description: string | null
          difficulty_comment: string | null
          exam_system: string | null
          id: string
          important_topics: string | null
          past_years_info: string | null
          recommended_sources: string | null
          teaching_style: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          description?: string | null
          difficulty_comment?: string | null
          exam_system?: string | null
          id?: string
          important_topics?: string | null
          past_years_info?: string | null
          recommended_sources?: string | null
          teaching_style?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          description?: string | null
          difficulty_comment?: string | null
          exam_system?: string | null
          id?: string
          important_topics?: string | null
          past_years_info?: string | null
          recommended_sources?: string | null
          teaching_style?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_wikis_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          created_at: string
          department: string
          description: string | null
          id: string
          is_common: boolean
          name: string
          university: string
          year: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          is_common?: boolean
          name: string
          university?: string
          year?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          is_common?: boolean
          name?: string
          university?: string
          year?: number | null
        }
        Relationships: []
      }
      deleted_emails: {
        Row: {
          cooldown_until: string
          deleted_at: string
          email: string
          id: string
        }
        Insert: {
          cooldown_until?: string
          deleted_at?: string
          email: string
          id?: string
        }
        Update: {
          cooldown_until?: string
          deleted_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          faculty: string | null
          id: string
          name: string
          name_normalized: string | null
          program_years: number
          university: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          faculty?: string | null
          id?: string
          name: string
          name_normalized?: string | null
          program_years?: number
          university: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          faculty?: string | null
          id?: string
          name?: string
          name_normalized?: string | null
          program_years?: number
          university?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          notify_uploads: boolean
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          notify_uploads?: boolean
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          notify_uploads?: boolean
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          action: string
          admin_id: string | null
          content_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          admin_action: string | null
          admin_note: string | null
          ai_confidence: number | null
          content_id: string
          content_text: string | null
          content_type: string
          content_url: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          user_id: string
          violation_type: string
        }
        Insert: {
          admin_action?: string | null
          admin_note?: string | null
          ai_confidence?: number | null
          content_id: string
          content_text?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          user_id: string
          violation_type: string
        }
        Update: {
          admin_action?: string | null
          admin_note?: string | null
          ai_confidence?: number | null
          content_id?: string
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_downloads: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_downloads_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comment_count: number | null
          content: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          course_id: string
          created_at: string
          discussion_type: string | null
          download_count: number | null
          file_name: string | null
          file_url: string | null
          helpful_count: number | null
          id: string
          is_anonymous: boolean | null
          is_pinned: boolean | null
          is_question: boolean | null
          is_solved: boolean | null
          search_vector: unknown
          solved_comment_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_count?: number | null
          content?: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          course_id: string
          created_at?: string
          discussion_type?: string | null
          download_count?: number | null
          file_name?: string | null
          file_url?: string | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_pinned?: boolean | null
          is_question?: boolean | null
          is_solved?: boolean | null
          search_vector?: unknown
          solved_comment_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_count?: number | null
          content?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          course_id?: string
          created_at?: string
          discussion_type?: string | null
          download_count?: number | null
          file_name?: string | null
          file_url?: string | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_pinned?: boolean | null
          is_question?: boolean | null
          is_solved?: boolean | null
          search_vector?: unknown
          solved_comment_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_solved_comment_id_fkey"
            columns: ["solved_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          class_year: number | null
          created_at: string
          department: string | null
          display_name: string | null
          email_domain: string | null
          id: string
          is_muted: boolean
          is_suspended: boolean
          moderation_score: number
          muted_until: string | null
          onboarding_completed: boolean | null
          reputation_points: number | null
          suspended_until: string | null
          university: string | null
          university_locked: boolean
          updated_at: string
          user_id: string
          username: string | null
          username_changed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          class_year?: number | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email_domain?: string | null
          id?: string
          is_muted?: boolean
          is_suspended?: boolean
          moderation_score?: number
          muted_until?: string | null
          onboarding_completed?: boolean | null
          reputation_points?: number | null
          suspended_until?: string | null
          university?: string | null
          university_locked?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
          username_changed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          class_year?: number | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email_domain?: string | null
          id?: string
          is_muted?: boolean
          is_suspended?: boolean
          moderation_score?: number
          muted_until?: string | null
          onboarding_completed?: boolean | null
          reputation_points?: number | null
          suspended_until?: string | null
          university?: string | null
          university_locked?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
          username_changed_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      university_domain_requests: {
        Row: {
          admin_note: string | null
          claimed_university_name: string
          created_at: string
          id: string
          request_email: string
          request_email_domain: string
          request_note: string | null
          requester_user_id: string | null
          resolved_domain: string | null
          resolved_university_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          claimed_university_name: string
          created_at?: string
          id?: string
          request_email: string
          request_email_domain: string
          request_note?: string | null
          requester_user_id?: string | null
          resolved_domain?: string | null
          resolved_university_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          claimed_university_name?: string
          created_at?: string
          id?: string
          request_email?: string
          request_email_domain?: string
          request_note?: string | null
          requester_user_id?: string | null
          resolved_domain?: string | null
          resolved_university_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_domain_requests_resolved_university_id_fkey"
            columns: ["resolved_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_email_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          is_verified: boolean
          university_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          university_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_email_domains_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      university_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          university: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          university: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          university?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          connection_requests_blocked: boolean
          created_at: string
          dm_allowed: string
          dm_notifications: boolean
          dnd_mode: boolean
          ghost_mode: boolean
          id: string
          mention_notifications: boolean
          reply_notifications: boolean
          system_notifications: boolean
          updated_at: string
          user_id: string
          vote_notifications: boolean
        }
        Insert: {
          connection_requests_blocked?: boolean
          created_at?: string
          dm_allowed?: string
          dm_notifications?: boolean
          dnd_mode?: boolean
          ghost_mode?: boolean
          id?: string
          mention_notifications?: boolean
          reply_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id: string
          vote_notifications?: boolean
        }
        Update: {
          connection_requests_blocked?: boolean
          created_at?: string
          dm_allowed?: string
          dm_notifications?: boolean
          dnd_mode?: boolean
          ghost_mode?: boolean
          id?: string
          mention_notifications?: boolean
          reply_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id?: string
          vote_notifications?: boolean
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type?: number
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_process_university_domain_request: {
        Args: {
          p_action: string
          p_admin_note?: string
          p_city?: string
          p_country?: string
          p_domain?: string
          p_request_id: string
          p_seed_general_department?: boolean
          p_type?: string
          p_university_name?: string
        }
        Returns: Json
      }
      admin_update_academic_info: {
        Args: {
          p_class_year?: number
          p_department?: string
          p_target_user_id: string
          p_university?: string
        }
        Returns: Json
      }
      auto_clear_expired_penalties: { Args: never; Returns: undefined }
      create_university_domain_request: {
        Args: {
          p_claimed_university_name: string
          p_request_email: string
          p_request_note?: string
        }
        Returns: Json
      }
      decrement_comment_like: {
        Args: { comment_id_input: string }
        Returns: undefined
      }
      decrement_helpful_count: {
        Args: { post_id_input: string }
        Returns: undefined
      }
      handle_vote: {
        Args: { p_direction: number; p_post_id: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_email_domain: {
        Args: { p_email: string }
        Returns: string
      }
      resolve_university_by_email_domain: {
        Args: { p_email: string }
        Returns: {
          country: string | null
          domain: string | null
          found: boolean
          university_id: string | null
          university_name: string | null
        }[]
      }
      increment_comment_like: {
        Args: { comment_id_input: string }
        Returns: undefined
      }
      increment_download_count: {
        Args: { post_id_input: string }
        Returns: undefined
      }
      increment_helpful_count: {
        Args: { post_id_input: string }
        Returns: undefined
      }
      increment_moderation_score: {
        Args: { p_points: number; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      safe_increment_download: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      content_type: "notes" | "past_exams" | "discussion" | "kaynaklar"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      content_type: ["notes", "past_exams", "discussion", "kaynaklar"],
    },
  },
} as const
