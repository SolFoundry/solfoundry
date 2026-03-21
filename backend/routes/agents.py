from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest
import sqlite3
import uuid
from datetime import datetime
import re

agents_bp = Blueprint('agents', __name__, url_prefix='/agents')

def get_db_connection():
    """Get database connection using app config"""
    db_path = current_app.config.get('DATABASE_PATH', 'solfoundry.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def validate_agent_data(data, is_update=False):
    """Validate agent registration/update data"""
    errors = []

    if not is_update:
        # Required fields for registration
        required_fields = ['name', 'description', 'wallet_address', 'capabilities']
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"Field '{field}' is required")

    # Validate wallet address format (basic Solana address check)
    if 'wallet_address' in data and data['wallet_address']:
        wallet = data['wallet_address'].strip()
        if not re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', wallet):
            errors.append("Invalid Solana wallet address format")

    # Validate name length
    if 'name' in data and data['name']:
        if len(data['name'].strip()) < 2:
            errors.append("Agent name must be at least 2 characters")
        if len(data['name'].strip()) > 100:
            errors.append("Agent name cannot exceed 100 characters")

    # Validate description
    if 'description' in data and data['description']:
        if len(data['description'].strip()) > 1000:
            errors.append("Description cannot exceed 1000 characters")

    # Validate capabilities
    if 'capabilities' in data:
        if isinstance(data['capabilities'], list):
            for cap in data['capabilities']:
                if not isinstance(cap, str) or len(cap.strip()) == 0:
                    errors.append("All capabilities must be non-empty strings")
        else:
            errors.append("Capabilities must be an array of strings")

    return errors

@agents_bp.route('/register', methods=['POST'])
def register_agent():
    """Register a new agent"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must contain JSON data'}), 400

        # Validate input data
        validation_errors = validate_agent_data(data)
        if validation_errors:
            return jsonify({'errors': validation_errors}), 400

        agent_id = str(uuid.uuid4())
        capabilities_json = ','.join(data['capabilities']) if isinstance(data['capabilities'], list) else str(data['capabilities'])

        conn = get_db_connection()
        try:
            # Check if wallet address already exists
            existing = conn.execute(
                'SELECT id FROM agents WHERE wallet_address = ?',
                (data['wallet_address'].strip(),)
            ).fetchone()

            if existing:
                return jsonify({'error': 'Agent with this wallet address already exists'}), 409

            # Insert new agent
            conn.execute('''
                INSERT INTO agents (id, name, description, wallet_address, capabilities, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                agent_id,
                data['name'].strip(),
                data['description'].strip(),
                data['wallet_address'].strip(),
                capabilities_json,
                'active',
                datetime.utcnow().isoformat(),
                datetime.utcnow().isoformat()
            ))
            conn.commit()

            # Return created agent
            agent = conn.execute('SELECT * FROM agents WHERE id = ?', (agent_id,)).fetchone()
            return jsonify({
                'id': agent['id'],
                'name': agent['name'],
                'description': agent['description'],
                'wallet_address': agent['wallet_address'],
                'capabilities': agent['capabilities'].split(',') if agent['capabilities'] else [],
                'status': agent['status'],
                'created_at': agent['created_at'],
                'updated_at': agent['updated_at']
            }), 201

        finally:
            conn.close()

    except BadRequest:
        return jsonify({'error': 'Invalid JSON in request body'}), 400
    except Exception as e:
        current_app.logger.error(f"Agent registration error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@agents_bp.route('', methods=['GET'])
def get_agents():
    """Get all agents with optional filtering"""
    try:
        # Query parameters
        status = request.args.get('status')
        limit = request.args.get('limit', type=int, default=50)
        offset = request.args.get('offset', type=int, default=0)

        if limit > 100:
            limit = 100
        if limit < 1:
            limit = 1
        if offset < 0:
            offset = 0

        conn = get_db_connection()
        try:
            # Build query
            query = 'SELECT * FROM agents'
            params = []

            if status:
                query += ' WHERE status = ?'
                params.append(status)

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
            params.extend([limit, offset])

            agents = conn.execute(query, params).fetchall()

            # Format response
            agent_list = []
            for agent in agents:
                agent_list.append({
                    'id': agent['id'],
                    'name': agent['name'],
                    'description': agent['description'],
                    'wallet_address': agent['wallet_address'],
                    'capabilities': agent['capabilities'].split(',') if agent['capabilities'] else [],
                    'status': agent['status'],
                    'created_at': agent['created_at'],
                    'updated_at': agent['updated_at']
                })

            return jsonify({
                'agents': agent_list,
                'count': len(agent_list),
                'limit': limit,
                'offset': offset
            })

        finally:
            conn.close()

    except Exception as e:
        current_app.logger.error(f"Get agents error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@agents_bp.route('/<agent_id>', methods=['GET'])
def get_agent(agent_id):
    """Get a specific agent by ID"""
    try:
        # Validate UUID format
        try:
            uuid.UUID(agent_id)
        except ValueError:
            return jsonify({'error': 'Invalid agent ID format'}), 400

        conn = get_db_connection()
        try:
            agent = conn.execute('SELECT * FROM agents WHERE id = ?', (agent_id,)).fetchone()

            if not agent:
                return jsonify({'error': 'Agent not found'}), 404

            return jsonify({
                'id': agent['id'],
                'name': agent['name'],
                'description': agent['description'],
                'wallet_address': agent['wallet_address'],
                'capabilities': agent['capabilities'].split(',') if agent['capabilities'] else [],
                'status': agent['status'],
                'created_at': agent['created_at'],
                'updated_at': agent['updated_at']
            })

        finally:
            conn.close()

    except Exception as e:
        current_app.logger.error(f"Get agent error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@agents_bp.route('/<agent_id>', methods=['PUT'])
def update_agent(agent_id):
    """Update an existing agent"""
    try:
        # Validate UUID format
        try:
            uuid.UUID(agent_id)
        except ValueError:
            return jsonify({'error': 'Invalid agent ID format'}), 400

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must contain JSON data'}), 400

        # Validate input data
        validation_errors = validate_agent_data(data, is_update=True)
        if validation_errors:
            return jsonify({'errors': validation_errors}), 400

        conn = get_db_connection()
        try:
            # Check if agent exists
            agent = conn.execute('SELECT * FROM agents WHERE id = ?', (agent_id,)).fetchone()
            if not agent:
                return jsonify({'error': 'Agent not found'}), 404

            # Build update query dynamically
            update_fields = []
            params = []

            for field in ['name', 'description', 'wallet_address', 'status']:
                if field in data and data[field] is not None:
                    update_fields.append(f"{field} = ?")
                    params.append(data[field].strip() if isinstance(data[field], str) else data[field])

            if 'capabilities' in data and data['capabilities'] is not None:
                update_fields.append("capabilities = ?")
                capabilities_json = ','.join(data['capabilities']) if isinstance(data['capabilities'], list) else str(data['capabilities'])
                params.append(capabilities_json)

            if not update_fields:
                return jsonify({'error': 'No valid fields provided for update'}), 400

            update_fields.append("updated_at = ?")
            params.append(datetime.utcnow().isoformat())
            params.append(agent_id)

            # Check wallet uniqueness if being updated
            if 'wallet_address' in data:
                existing = conn.execute(
                    'SELECT id FROM agents WHERE wallet_address = ? AND id != ?',
                    (data['wallet_address'].strip(), agent_id)
                ).fetchone()
                if existing:
                    return jsonify({'error': 'Another agent already uses this wallet address'}), 409

            query = f"UPDATE agents SET {', '.join(update_fields)} WHERE id = ?"
            conn.execute(query, params)
            conn.commit()

            # Return updated agent
            updated_agent = conn.execute('SELECT * FROM agents WHERE id = ?', (agent_id,)).fetchone()
            return jsonify({
                'id': updated_agent['id'],
                'name': updated_agent['name'],
                'description': updated_agent['description'],
                'wallet_address': updated_agent['wallet_address'],
                'capabilities': updated_agent['capabilities'].split(',') if updated_agent['capabilities'] else [],
                'status': updated_agent['status'],
                'created_at': updated_agent['created_at'],
                'updated_at': updated_agent['updated_at']
            })

        finally:
            conn.close()

    except BadRequest:
        return jsonify({'error': 'Invalid JSON in request body'}), 400
    except Exception as e:
        current_app.logger.error(f"Update agent error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@agents_bp.route('/<agent_id>', methods=['DELETE'])
def delete_agent(agent_id):
    """Delete an agent"""
    try:
        # Validate UUID format
        try:
            uuid.UUID(agent_id)
        except ValueError:
            return jsonify({'error': 'Invalid agent ID format'}), 400

        conn = get_db_connection()
        try:
            # Check if agent exists
            agent = conn.execute('SELECT * FROM agents WHERE id = ?', (agent_id,)).fetchone()
            if not agent:
                return jsonify({'error': 'Agent not found'}), 404

            # Delete agent
            conn.execute('DELETE FROM agents WHERE id = ?', (agent_id,))
            conn.commit()

            return jsonify({'message': 'Agent deleted successfully'}), 200

        finally:
            conn.close()

    except Exception as e:
        current_app.logger.error(f"Delete agent error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
