export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          home_lat: number | null;
          home_lng: number | null;
          visible_radius_km: number;
          privacy_level: "public" | "friends" | "private";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          home_lat?: number | null;
          home_lng?: number | null;
          visible_radius_km?: number;
          privacy_level?: "public" | "friends" | "private";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      books: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          author: string;
          isbn: string | null;
          cover_url: string | null;
          description: string | null;
          category: string;
          language: string;
          condition: "new" | "like_new" | "good" | "fair";
          publish_year: number | null;
          status: "available" | "pending" | "borrowed" | "hidden";
          location_lat: number | null;
          location_lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          author: string;
          isbn?: string | null;
          cover_url?: string | null;
          description?: string | null;
          category?: string;
          language?: string;
          condition?: "new" | "like_new" | "good" | "fair";
          publish_year?: number | null;
          status?: "available" | "pending" | "borrowed" | "hidden";
          location_lat?: number | null;
          location_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["books"]["Insert"]>;
      };
      borrow_requests: {
        Row: {
          id: string;
          book_id: string;
          borrower_id: string;
          lender_id: string;
          message: string | null;
          status: "pending" | "accepted" | "borrowed" | "return_requested" | "returned" | "rejected" | "canceled";
          requested_at: string;
          accepted_at: string | null;
          borrowed_at: string | null;
          returned_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          borrower_id: string;
          lender_id: string;
          message?: string | null;
          status?: "pending" | "accepted" | "borrowed" | "return_requested" | "returned" | "rejected" | "canceled";
          requested_at?: string;
          accepted_at?: string | null;
          borrowed_at?: string | null;
          returned_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["borrow_requests"]["Insert"]>;
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          receiver_id: string;
          status: "pending" | "accepted" | "rejected" | "blocked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          receiver_id: string;
          status?: "pending" | "accepted" | "rejected" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friendships"]["Insert"]>;
      };
      conversations: {
        Row: {
          id: string;
          type: "direct" | "borrow";
          borrow_request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: "direct" | "borrow";
          borrow_request_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversation_members"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          type: "text" | "system" | "borrow_card";
          body: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          type?: "text" | "system" | "borrow_card";
          body?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          reviewer_id: string;
          reviewee_id: string;
          book_id: string;
          borrow_request_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          reviewee_id: string;
          book_id: string;
          borrow_request_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["favorites"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string | null;
          book_id: string | null;
          reason: "spam" | "unsafe" | "inappropriate" | "copyright" | "other";
          detail: string | null;
          status: "open" | "reviewing" | "resolved" | "dismissed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id?: string | null;
          book_id?: string | null;
          reason: "spam" | "unsafe" | "inappropriate" | "copyright" | "other";
          detail?: string | null;
          status?: "open" | "reviewing" | "resolved" | "dismissed";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_books: {
        Args: {
          user_lat: number;
          user_lng: number;
          radius_km?: number;
        };
        Returns: Array<Database["public"]["Tables"]["books"]["Row"] & { distance_km: number }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
