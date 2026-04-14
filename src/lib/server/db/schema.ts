import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const bins = sqliteTable('bins', {
	id: text('id').primaryKey(),
	content: text('content').notNull(),
	type: text('type').notNull().default('markdown'),
	language: text('language'),
	mode: text('mode', { enum: ['read-only', 'editable', 'forkable'] })
		.notNull()
		.default('read-only'),
	password: text('password'),
	encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
	forked_from: text('forked_from'),
	expires_at: text('expires_at'),
	burn: integer('burn', { mode: 'boolean' }).notNull().default(false),
	created_at: text('created_at').notNull(),
	updated_at: text('updated_at').notNull()
});

export type Bin = typeof bins.$inferSelect;
export type NewBin = typeof bins.$inferInsert;
