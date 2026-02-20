from marshmallow import Schema, fields, validate, validates, ValidationError


class RegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8, max=128))
    display_name = fields.String(required=True, validate=validate.Length(min=1, max=100))

    @validates('password')
    def validate_password_strength(self, value):
        if not any(c.isupper() for c in value) and not any(c.isdigit() for c in value):
            raise ValidationError('비밀번호는 영문 대문자 또는 숫자를 포함해야 합니다.')


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True)


class GoogleAuthSchema(Schema):
    credential = fields.String(required=True)


class RefreshSchema(Schema):
    refresh_token = fields.String(required=True)
