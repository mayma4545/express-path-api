/**
 * Event Service
 * Business logic for event CRUD operations and search
 */

const { Op } = require('sequelize');
const { Event, Nodes } = require('../models');
const { logger } = require('../utils/logger');

class EventService {
  /**
   * Get active/upcoming events
   * @param {Object} filters - Optional filters (search, category, from_date, to_date)
   * @returns {Promise<Array>} List of active events with location data
   */
  async getActiveEvents(filters = {}) {
    const where = {
      is_active: true,
      [Op.or]: [
        { end_datetime: null },
        { end_datetime: { [Op.gte]: new Date() } }
      ]
    };

    if (filters.search) {
      where.event_name = { [Op.like]: `%${filters.search}%` };
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.from_date) {
      where.start_datetime = { [Op.gte]: new Date(filters.from_date) };
    }

    if (filters.to_date) {
      where.end_datetime = { [Op.lte]: new Date(filters.to_date) };
    }

    const events = await Event.findAll({
      where,
      include: [{
        model: Nodes,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level', 'map_x', 'map_y']
      }],
      order: [['start_datetime', 'ASC'], ['event_name', 'ASC']]
    });

    return events;
  }

  /**
   * Get all events (admin only - includes past and inactive)
   * @returns {Promise<Array>} All events with location data
   */
  async getAllEvents() {
    const events = await Event.findAll({
      include: [{
        model: Nodes,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level']
      }],
      order: [['start_datetime', 'DESC'], ['event_name', 'ASC']]
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
      include: [{
        model: Nodes,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level', 'map_x', 'map_y', 'description']
      }]
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

    const lowerQuery = query.toLowerCase();

    // Search events
    const events = await Event.findAll({
      where: {
        is_active: true,
        event_name: { [Op.like]: `%${query}%` },
        [Op.or]: [
          { end_datetime: null },
          { end_datetime: { [Op.gte]: new Date() } }
        ]
      },
      include: [{
        model: Nodes,
        as: 'location',
        attributes: ['node_id', 'node_code', 'name', 'building', 'floor_level']
      }],
      limit: 10,
      order: [['start_datetime', 'ASC']]
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
        event_id: e.event_id,
        event_name: e.event_name,
        category: e.category,
        start_datetime: e.start_datetime,
        end_datetime: e.end_datetime,
        node: e.location
      })),
      nodes: nodes.map(n => ({
        type: 'node',
        node_id: n.node_id,
        node_code: n.node_code,
        name: n.name,
        building: n.building,
        floor_level: n.floor_level
      }))
    };
  }

  /**
   * Create a new event (admin only)
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(eventData) {
    const { event_name, description, category, node_id, start_datetime, end_datetime, is_active, is_featured } = eventData;

    // Validate node exists
    const node = await Nodes.findByPk(node_id);
    if (!node) {
      throw new Error('Node not found');
    }

    // Validate dates if provided
    if (start_datetime && end_datetime) {
      if (new Date(start_datetime) >= new Date(end_datetime)) {
        throw new Error('Start datetime must be before end datetime');
      }
    }

    const event = await Event.create({
      event_name,
      description: description || null,
      category: category || null,
      node_id: parseInt(node_id),
      start_datetime: start_datetime ? new Date(start_datetime) : null,
      end_datetime: end_datetime ? new Date(end_datetime) : null,
      is_active: is_active !== undefined ? is_active : true,
      is_featured: is_featured !== undefined ? is_featured : false
    });

    logger.info(`Event created: ${event.event_name}`, { eventId: event.event_id });

    // Fetch complete event with location data
    return await this.getEventById(event.event_id);
  }

  /**
   * Update an existing event (admin only)
   * @param {number} eventId - Event ID
   * @param {Object} eventData - Updated event data
   * @returns {Promise<Object|null>} Updated event or null
   */
  async updateEvent(eventId, eventData) {
    const event = await Event.findByPk(eventId);

    if (!event) {
      return null;
    }

    const { event_name, description, category, node_id, start_datetime, end_datetime, is_active, is_featured } = eventData;

    // Validate node if being changed
    if (node_id && node_id !== event.node_id) {
      const node = await Nodes.findByPk(node_id);
      if (!node) {
        throw new Error('Node not found');
      }
    }

    // Validate dates if provided
    const newStart = start_datetime ? new Date(start_datetime) : event.start_datetime;
    const newEnd = end_datetime ? new Date(end_datetime) : event.end_datetime;
    if (newStart && newEnd && newStart >= newEnd) {
      throw new Error('Start datetime must be before end datetime');
    }

    const updateData = {
      event_name: event_name || event.event_name,
      description: description !== undefined ? description : event.description,
      category: category !== undefined ? category : event.category,
      node_id: node_id ? parseInt(node_id) : event.node_id,
      start_datetime: start_datetime ? new Date(start_datetime) : event.start_datetime,
      end_datetime: end_datetime ? new Date(end_datetime) : event.end_datetime,
      is_active: is_active !== undefined ? is_active : event.is_active,
      is_featured: is_featured !== undefined ? is_featured : event.is_featured
    };

    await event.update(updateData);

    logger.info(`Event updated: ${event.event_name}`, { eventId: event.event_id });

    // Fetch complete event with location data
    return await this.getEventById(event.event_id);
  }

  /**
   * Delete an event (admin only)
   * @param {number} eventId - Event ID
   * @returns {Promise<Object|null>} Deleted event info or null
   */
  async deleteEvent(eventId) {
    const event = await Event.findByPk(eventId);

    if (!event) {
      return null;
    }

    const eventName = event.event_name;

    await event.destroy();

    logger.info(`Event deleted: ${eventName}`, { eventId });

    return { success: true, eventName };
  }

  /**
   * Get event statistics (admin dashboard)
   * @returns {Promise<Object>} Event statistics
   */
  async getStats() {
    const now = new Date();

    const [totalEvents, activeEvents, upcomingEvents, pastEvents] = await Promise.all([
      Event.count(),
      Event.count({ where: { is_active: true } }),
      Event.count({
        where: {
          is_active: true,
          start_datetime: { [Op.gte]: now }
        }
      }),
      Event.count({
        where: {
          end_datetime: { [Op.lt]: now }
        }
      })
    ]);

    return {
      totalEvents,
      activeEvents,
      upcomingEvents,
      pastEvents
    };
  }
}

module.exports = new EventService();
