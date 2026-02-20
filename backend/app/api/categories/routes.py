from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError

from app.extensions import db
from app.models.journal_category import JournalCategory
from app.utils.helpers import api_response, api_error

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


class CategorySchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    icon = fields.String(load_default=None, allow_none=True)
    color = fields.String(load_default=None, allow_none=True, validate=validate.Length(max=7))
    display_order = fields.Integer(load_default=0)


class CategoryUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1, max=100))
    icon = fields.String(allow_none=True)
    color = fields.String(allow_none=True, validate=validate.Length(max=7))
    display_order = fields.Integer()
    is_active = fields.Boolean()


create_schema = CategorySchema()
update_schema = CategoryUpdateSchema()


@categories_bp.route('', methods=['GET'])
@jwt_required()
def list_categories():
    user_id = get_jwt_identity()
    cats = (JournalCategory.query
            .filter_by(user_id=user_id, is_active=True)
            .order_by(JournalCategory.display_order, JournalCategory.created_at)
            .all())
    return api_response({'categories': [c.to_dict() for c in cats]})


@categories_bp.route('', methods=['POST'])
@jwt_required()
def create_category():
    user_id = get_jwt_identity()
    try:
        data = create_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    cat = JournalCategory(user_id=user_id, **data)
    db.session.add(cat)
    db.session.commit()
    return api_response({'category': cat.to_dict()}, status=201)


@categories_bp.route('/<uuid:category_id>', methods=['PATCH'])
@jwt_required()
def update_category(category_id):
    user_id = get_jwt_identity()
    cat = JournalCategory.query.filter_by(id=category_id, user_id=user_id).first_or_404()

    try:
        data = update_schema.load(request.get_json() or {})
    except ValidationError as e:
        return api_error('입력값을 확인해주세요.', 422, e.messages)

    for key, value in data.items():
        setattr(cat, key, value)
    db.session.commit()
    return api_response({'category': cat.to_dict()})


@categories_bp.route('/<uuid:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    user_id = get_jwt_identity()
    cat = JournalCategory.query.filter_by(id=category_id, user_id=user_id).first_or_404()
    cat.is_active = False
    db.session.commit()
    return api_response({'message': '카테고리가 삭제되었습니다.'})
