/**
 * Event Service
 * Business logic for event CRUD operations and search
 */

const { Op } = require('sequelize');
const { 
  Event, 
  Nodes, 
  EventBookmark, 
  EventLike, 
  EventAttendee, 
  EventAnalytics, 
  EventRating, 
  EventVisit, 
  EventPhoto, 
  EventAnnouncement, 
  OrganizerNotification, 
  UserNotification, 
  Comment, 
  CommentReaction,
  sequelize 
} = require('../models');
const { logger } = require('../utils/logger');

class EventService {
  /**
   * Get active/upcoming events
   * @param {Object} filters - Optional filters (search, category, from_date, to_date)
   * @returns {Promise<Array>} List of active events with location data
   */
  async getActiveEvents(filters = {}) {
    const where = {
      is_ongoing: true
    };

    if (filters.search) {
      where.title = { [Op.like]: `%${filters.search}%` };
    }

    if (filters.category) {
      // Assuming filters.category is category_id
      where.category_id = filters.category;
    }

    if (filters.from_date) {
      where.event_date = { [Op.gte]: filters.from_date };
    }

    if (filters.to_date) {
      where.event_date = { [Op.lte]: filters.to_date };
    }

    const events = await Event.findAll({
      where,
      include: ['category'],
      order: [['event_date', 'ASC'], ['start_time', 'ASC']]
    });

    return events;
  }

  /**
   * Get all events (admin only - includes past and inactive)
   * @returns {Promise<Array>} All events with location data
   */
  async getAllEvents() {
    const events = await Event.findAll({
      include: ['category', 'organizer'],
      order: [['event_date', 'DESC'], ['start_time', 'ASC']]
    });

    return events;
  }

  /**
   * Get a single event by ID
   * @param {number} eventId - Event ID
   * @returns {Promise<Object|null>} Event with location data or null
   */
  async getEventById(eventId) {
    const event = await Event.findByPk(eventId, {
      include: ['category', 'organizer', 'announcements', 'photos']
    });

    return event;
  }

  /**
   * Combined search for events and nodes
   * @param {string} query - Search query
   * @returns {Promise<Object>} Object with events and nodes arrays
   */
  async combinedSearch(query) {
    if (!query || query.trim() === '') {
      return { events: [], nodes: [] };
    }

    // Search events
    const events = await Event.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
          { venue: { [Op.like]: `%${query}%` } }
        ]
      },
      include: ['category'],
      limit: 10,
      order: [['event_date', 'ASC']]
    });

    // Search nodes
    const nodes = await Nodes.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { node_code: { [Op.like]: `%${query}%` } },
          { building: { [Op.like]: `%${query}%` } }
        ]
      },
      limit: 10,
      order: [['name', 'ASC']]
    });

    return {
      events: events.map(e => ({
        type: 'event',
        id: e.id,
        title: e.title,
        category: e.category ? e.category.name : null,
        event_date: e.event_date,
        start_time: e.start_time,
        venue: e.venue
      })),
      nodes: nodes.map(n => ({
        type: 'node',
        node_id: n.node_id,
        node_code: n.node_code,
        name: n.name,
        building: n.building,
        floor_level: n.floor_level,
        type_of_node: n.type_of_node,
        image360: n.image360 || null
      }))
    };
  }

  /**
   * Create a new event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData) {
    const event = await Event.create(eventData);
    logger.info(`Event created: ${event.title}`, { eventId: event.id });
    return await this.getEventById(event.id);
  }

  /**
   * Update an existing event
   * @param {number} eventId - Event ID
   * @param {Object} eventData - Updated event data
   * @returns {Promise<Object|null>} Updated event or null
   */
  async updateEvent(eventId, eventData) {
    const event = await Event.findByPk(eventId);

    if (!event) {
      return null;
    }

    await event.update(eventData);
    logger.info(`Event updated: ${event.title}`, { eventId: event.id });
    return await this.getEventById(event.id);
  }

  /**
   * Delete an event
   * @param {number} eventId - Event ID
   * @returns {Promise<Object|null>} Deleted event info or null
   */
  async deleteEvent(eventId) {
    const event = await Event.findByPk(eventId);

    if (!event) {
      return null;
    }

    const eventTitle = event.title;

    await sequelize.transaction(async (t) => {
      // 1. Delete dependent data
      await EventBookmark.destroy({ where: { event_id: eventId }, transaction: t });
      await EventLike.destroy({ where: { event_id: eventId }, transaction: t });
      await EventAttendee.destroy({ where: { event_id: eventId }, transaction: t });
      await EventAnalytics.destroy({ where: { event_id: eventId }, transaction: t });
      await EventRating.destroy({ where: { event_id: eventId }, transaction: t });
      await EventVisit.destroy({ where: { event_id: eventId }, transaction: t });
      await EventPhoto.destroy({ where: { event_id: eventId }, transaction: t });
      await EventAnnouncement.destroy({ where: { event_id: eventId }, transaction: t });
      await OrganizerNotification.destroy({ where: { event_id: eventId }, transaction: t });
      await UserNotification.destroy({ where: { event_id: eventId }, transaction: t });

      // Comments and reactions
      const comments = await Comment.findAll({ where: { event_id: eventId }, attributes: ['id'], transaction: t });
      const commentIds = comments.map(c => c.id);
      if (commentIds.length > 0) {
        await CommentReaction.destroy({ where: { comment_id: commentIds }, transaction: t });
        await Comment.destroy({ where: { event_id: eventId }, transaction: t });
      }

      // 2. Finally delete the event
      await event.destroy({ transaction: t });
    });

    logger.info(`Event deleted: ${eventTitle}`, { eventId });

    return { success: true, eventTitle };
  }

  /**
   * Get event statistics
   * @returns {Promise<Object>} Event statistics
   */
  async getStats() {
    const today = new Date().toISOString().split('T')[0];

    const [totalEvents, activeEvents, upcomingEvents] = await Promise.all([
      Event.count(),
      Event.count({ where: { is_ongoing: true } }),
      Event.count({
        where: {
          event_date: { [Op.gte]: today }
        }
      })
    ]);

    return {
      totalEvents,
      activeEvents,
      upcomingEvents
    };
  }
}

module.exports = new EventService();
